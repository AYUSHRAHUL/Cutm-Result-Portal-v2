import { NextResponse } from "next/server";
import { clientPromise } from "@/lib/mongodb";

export async function POST(req) {
  try {
    const { branch, batch } = await req.json();
    const client = await clientPromise;
    const db = client.db("cutm1");
    const cutm = db.collection("CUTM1");

    const query = {};
    const andConds = [];

    // Batch condition
    if (batch && batch !== 'All') {
      const yy = batch.length === 4 ? batch.slice(-2) : batch;
      andConds.push({ Reg_No: { $regex: `^${yy}` } });
    }

    // Branch condition: support multiple Reg_No department codes and branch_overrides
    if (branch && branch !== 'All') {
      const codes = branchCodes(branch);
      const orConds = [];
      if (codes && codes.length > 0) {
        codes.forEach(c => orConds.push({ Reg_No: { $regex: `^.{7}${c}` } }));
      }

      // Include overrides where admin has changed branch without changing Reg_No
      try {
        const normalized = normalizeBranchFullName(branch);
        if (normalized) {
          const ovDocs = await db.collection("branch_overrides").find({ branch: normalized }).project({ reg: 1 }).toArray();
          const regs = ovDocs.map(d => d.reg).filter(Boolean);
          if (regs.length > 0) {
            // Convert to strings and normalize
            const regStrings = regs.map(r => String(r).toUpperCase());
            orConds.push({ Reg_No: { $in: regStrings } });
          }
        }
      } catch (err) {
        console.error("Error fetching branch overrides:", err);
      }

      if (orConds.length > 0) {
        andConds.push({ $or: orConds });
      }
    }

    if (andConds.length > 0) query.$and = andConds;

    // Fetch all result records (subject records) matching the criteria
    // This will return all subject records for students matching batch/branch
    const resultRecords = await cutm
      .find(query)
      .project({
        _id: 0,
        Reg_No: 1,
        Name: 1,
        Sem: 1,
        Subject_Code: 1,
        Subject_Name: 1,
        Credits: 1,
        Grade: 1,
      })
      .toArray();

    // Also check RegistrationData collection for any records not in CUTM1
    // But only if they match the branch/batch criteria
    let regDataRecords = [];
    try {
      const regData = db.collection("RegistrationData");
      let regDataQuery = {};
      
      if (batch && batch !== 'All') {
        const yy = batch.length === 4 ? batch.slice(-2) : batch;
        regDataQuery.$and = [{ Reg_No: { $regex: `^${yy}` } }];
        
        if (branch && branch !== 'All') {
          const codes = branchCodes(branch);
          const normalized = normalizeBranchFullName(branch);
          const orConds = [];
          
          if (codes && codes.length > 0) {
            codes.forEach(c => orConds.push({ Reg_No: { $regex: `^.{7}${c}` } }));
          }
          
          if (normalized) {
            const ovDocs = await db.collection("branch_overrides").find({ branch: normalized }).project({ reg: 1 }).toArray();
            const regs = ovDocs.map(d => String(d.reg).toUpperCase()).filter(Boolean);
            if (regs.length > 0) {
              orConds.push({ Reg_No: { $in: regs } });
            }
          }
          
          if (orConds.length > 0) {
            regDataQuery.$and.push({ $or: orConds });
          }
        }
      } else if (branch && branch !== 'All') {
        const codes = branchCodes(branch);
        const normalized = normalizeBranchFullName(branch);
        const orConds = [];
        
        if (codes && codes.length > 0) {
          codes.forEach(c => orConds.push({ Reg_No: { $regex: `^.{7}${c}` } }));
        }
        
        if (normalized) {
          const ovDocs = await db.collection("branch_overrides").find({ branch: normalized }).project({ reg: 1 }).toArray();
          const regs = ovDocs.map(d => String(d.reg).toUpperCase()).filter(Boolean);
          if (regs.length > 0) {
            orConds.push({ Reg_No: { $in: regs } });
          }
        }
        
        if (orConds.length > 0) {
          regDataQuery.$or = orConds;
        }
      }

      // Only fetch RegistrationData records that have result fields (Sem, Subject_Code, etc.)
      if (Object.keys(regDataQuery).length > 0) {
        regDataRecords = await regData
          .find(regDataQuery)
          .project({
            _id: 0,
            Reg_No: 1,
            Name: 1,
            Sem: 1,
            Subject_Code: 1,
            Subject_Name: 1,
            Credits: 1,
            Grade: 1,
          })
          .toArray()
          .catch(() => []);
      }
    } catch (err) {
      console.error("Error fetching RegistrationData:", err);
    }

    // Merge and normalize Reg_No to strings
    const allRecords = [...resultRecords, ...regDataRecords].map(record => ({
      ...record,
      Reg_No: String(record.Reg_No || "").toUpperCase(),
    }));

    // Remove duplicates (same Reg_No + Subject_Code + Sem combination)
    const seen = new Set();
    const uniqueRecords = allRecords.filter(record => {
      if (!record.Reg_No || !record.Subject_Code) return false;
      const key = `${record.Reg_No}|${record.Subject_Code}|${record.Sem || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({ 
      records: uniqueRecords,
      message: `${uniqueRecords.length} result records found`
    });
  } catch (err) {
    console.error("/api/batch error", err);
    return NextResponse.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}

function branchCodes(name) {
  // Support historical department codes
  const map = { Civil: ['1','9'], CSE: ['2','8'], ECE: ['3','4'], EEE: ['5'], Mechanical: ['6'], AIML: ['7'] };
  return map[name] || [];
}

function normalizeBranchFullName(input) {
  const up = String(input || "").trim().toUpperCase();
  if (!up) return null;
  if (up === 'AIML' || up.includes('ARTIFICIAL')) return 'AIML';
  if (up === 'CIVIL' || up.includes('CIVIL')) return 'Civil Engineering';
  if (up === 'CSE' || up.includes('COMPUTER')) return 'Computer Science Engineering';
  if (up === 'ECE' || up.includes('ELECTRONICS & COMMUNICATION')) return 'Electronics & Communication Engineering';
  if (up === 'EEE' || (up.includes('ELECTRICAL') && !up.includes('COMMUNICATION'))) return 'Electrical & Electronics Engineering';
  if (up === 'MECHANICAL' || up === 'ME' || up.includes('MECHANICAL')) return 'Mechanical Engineering';
  return null;
}



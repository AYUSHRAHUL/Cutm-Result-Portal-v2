import { clientPromise } from "@/lib/mongodb";
import {
  getDatabaseFromRegistration,
  getSchoolFromRegistration,
  getSomStudentDatabaseCandidates,
  getSomProgramFromRegistration,
} from "@/lib/campus";

export function resultRegMatch(regNo) {
  const reg = String(regNo || "").toUpperCase().trim();
  const n = parseInt(reg, 10);
  if (Number.isNaN(n) || String(n) !== reg) {
    return { Reg_No: reg };
  }
  return { $or: [{ Reg_No: reg }, { Reg_No: n }] };
}

export function semesterStringsFromNumbers(nums) {
  const out = new Set();
  for (const n of nums) {
    const s = String(n);
    out.add(`Sem ${s}`);
    out.add(`SEM ${s}`);
    out.add(`sem ${s}`);
    out.add(s);
    out.add(`Semester ${s}`);
    out.add(`SEMESTER ${s}`);
    out.add(`Sem${s}`);
    out.add(`SEM${s}`);
  }
  return Array.from(out);
}

/**
 * @returns {Promise<{ eligible: boolean, eligibleDbName: string|null, dbList: string[], message: string|null, isSom: boolean, somProgram: string|null }>}
 */
export async function getPlacementEligibilityContext(regNo) {
  const reg = String(regNo || "").toUpperCase().trim();
  if (!reg) {
    return {
      eligible: false,
      eligibleDbName: null,
      dbList: [],
      message: "Could not determine registration number",
      isSom: false,
      somProgram: null,
    };
  }

  const client = await clientPromise;
  const school = getSchoolFromRegistration(reg);
  const isSom = school === "SOM";
  const somProgram = isSom ? getSomProgramFromRegistration(reg) : null;

  const semVariants =
    isSom && somProgram === "MBA"
      ? semesterStringsFromNumbers([3, 4])
      : isSom
        ? semesterStringsFromNumbers([5, 6, 7, 8])
        : semesterStringsFromNumbers([7]);

  const dbList = isSom ? getSomStudentDatabaseCandidates(reg) : [getDatabaseFromRegistration(reg)];

  let eligibleDbName = null;

  for (const dbName of dbList) {
    const db = client.db(dbName);

    const regCheck = await db.collection("RegistrationData").findOne({
      $and: [
        { $or: [{ Reg_No: reg }, { Rollno: reg }] },
        { Sem: { $in: semVariants } },
      ],
    });

    const resultCol = isSom ? "som_result" : "result";
    const resultCheck = await db.collection(resultCol).findOne({
      $and: [resultRegMatch(reg), { Sem: { $in: semVariants } }],
    });

    if (regCheck || resultCheck) {
      eligibleDbName = dbName;
      break;
    }
  }

  const message = eligibleDbName
    ? null
    : isSom
      ? somProgram === "MBA"
        ? "Placement portal opens from 3rd semester. Your Sem 3 (or later) registration/result is not in the records yet."
        : "Placement portal opens from 5th semester. Your Sem 5 (or later) registration/result is not in the records yet."
      : "Placement portal is only available for 7th Semester students.";

  return {
    eligible: !!eligibleDbName,
    eligibleDbName,
    dbList,
    message,
    isSom,
    somProgram,
  };
}

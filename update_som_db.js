const fs = require('fs');
const path = require('path');

const rootDir = 'd:\\Cutm-Result-Portal-v2\\app\\api\\som';

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir(rootDir, (filePath) => {
  if (!filePath.endsWith('.js')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Collection name update (global pattern)
  content = content.replace(/collection\(['"]result['"]\)/g, 'collection("som_result")');
  content = content.replace(/collection\(['"]CUTM1['"]\)/g, 'collection("som_result")');
  content = content.replace(/"source":\s*['"]CUTM1['"]/g, '"source": "som_result"');

  // 2. School context update (global pattern)
  content = content.replace(/const school\s*=\s*['"]SOET['"]/g, "const school = 'SOM'");
  content = content.replace(/school:\s*['"]SOET['"]/g, "school: 'SOM'");

  // 3. Messages and comments
  content = content.replace(/SOET (Analytics|Upload|Result|Route|Backend)/g, 'SOM $1');
  content = content.replace(/B\.Tech/g, 'SOM (BBA/MBA)');
  content = content.replace(/B\.Tech students only/g, 'BBA/MBA students only');

  // 4. Branch Map Logic (Recursive Replacement for specific patterns)
  // Pattern 1: branchCodeMap for B.Tech
  const btechBranchCodeMapRegex = /const branchCodeMap = \{[\s\S]*?\};/g;
  if (btechBranchCodeMapRegex.test(content)) {
    const somBranchCodeMap = `const branchCodeMap = {
      '912': ['BBA', 'BBA', 'Bachelor of Business Administration', 'Bachelor of Business Administration (BBA)'],
      '214': ['MBA', 'MBA', 'Master of Business Administration', 'Master of Business Administration (MBA)']
    };`;
    content = content.replace(btechBranchCodeMapRegex, somBranchCodeMap);
  }

  // Pattern 2: Analytics branchMap logic
  // Match the entire branchMap and its subsequent regex logic
  const analyticsBranchMapRegex = /const branchMap = \{[\s\S]*?\}\s*;\s*const branchCodes = branchMap\[branchFilter\] \|\| \[\];[\s\S]*?if \(orConditions\.length > 0\) \{[\s\S]*?matchConditions\.push\(\{ \$or: orConditions \}\);[\s\S]*?\}/g;
  if (analyticsBranchMapRegex.test(content)) {
    const somAnalyticsLogic = `const branchMap = {
        'BBA': ['912'],
        'MBA': ['214']
      };

      const branchCodes = branchMap[branchFilter] || [];
      if (branchCodes.length > 0) {
        const orConditions = branchCodes.map(code => ({
          Reg_No: { $regex: \`^.{5}\${code}\` }
        }));
        matchConditions.push({ $or: orConditions });
      }`;
    content = content.replace(analyticsBranchMapRegex, somAnalyticsLogic);
  }

  // 5. Registration Parsing Message Fixes
  content = content.replace(/This route is for B\.Tech \(SOET\) students only/g, 'This route is for SOM (BBA/MBA) students only');
  content = content.replace(/skippedNonBTech/g, 'skippedNonSOM');
  
  // Also fix the registration check (if it says index 7 somewhere)
  content = content.replace(/Reg_No: \{ \$regex: `\^\.\{7\}\[\$\{singleDigitCodes\.join\(['"]['"]\)\}\]` \}/g, 'Reg_No: { $regex: `^.{5}\${code}` }');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath.replace(rootDir, '')}`);
  }
});

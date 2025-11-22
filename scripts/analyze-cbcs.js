const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read the CBCS.xlsx file
const filePath = path.join(__dirname, '..', 'CBCS.xlsx');

if (!fs.existsSync(filePath)) {
  console.error('❌ CBCS.xlsx file not found at:', filePath);
  process.exit(1);
}

console.log('📊 Analyzing CBCS.xlsx file....\n');

try {
  // Read the workbook
  const workbook = XLSX.readFile(filePath);
  
  console.log('📋 Sheet Names:', workbook.SheetNames);
  console.log('📊 Total Sheets:', workbook.SheetNames.length);
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Analyze each sheet
  workbook.SheetNames.forEach((sheetName, index) => {
    console.log(`\n📄 Sheet ${index + 1}: "${sheetName}"`);
    console.log('-'.repeat(80));
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    if (data.length === 0) {
      console.log('⚠️  No data found in this sheet');
      return;
    }
    
    console.log(`✅  Total Rows: ${data.length}`);
    console.log(`📋 All Columns Found: ${Object.keys(data[0]).join(', ')}`);
    console.log(`\n📋 Column Details:`);
    Object.keys(data[0]).forEach((col, idx) => {
      console.log(`   ${idx + 1}. "${col}"`);
    });
    
    // Check for required columns (flexible matching)
    const requiredColumns = ['Branch', 'Basket', 'Subject Code', 'Subject Name', 'Credits'];
    const foundColumns = Object.keys(data[0]);
    const columnMap = {};
    
    // Try to map found columns to required columns
    foundColumns.forEach(found => {
      const foundLower = found.toLowerCase().replace(/\s+/g, '');
      requiredColumns.forEach(req => {
        const reqLower = req.toLowerCase().replace(/\s+/g, '');
        if (foundLower.includes(reqLower) || reqLower.includes(foundLower)) {
          columnMap[req] = found;
        }
      });
    });
    
    const missingColumns = requiredColumns.filter(col => !columnMap[col]);
    
    if (missingColumns.length > 0) {
      console.log(`\n⚠️  Missing Required Columns: ${missingColumns.join(', ')}`);
    } else {
      console.log(`\n✅ All required columns found (mapped):`);
      Object.entries(columnMap).forEach(([req, found]) => {
        console.log(`   • ${req} → "${found}"`);
      });
    }
    
    // Analyze data
    const branches = new Set();
    const baskets = new Set();
    const subjectCodes = new Set();
    let totalCredits = 0;
    let invalidRows = 0;
    
    // Flexible column matching
    const getValue = (row, possibleKeys) => {
      for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return String(row[key]).trim();
        }
      }
      return '';
    };
    
    data.forEach((row, idx) => {
      const branch = getValue(row, ['Branch', 'branch', 'Branch Name', 'Department', 'Dept']);
      const basket = getValue(row, ['Basket', 'basket', 'Basket Name']);
      const subjectCode = getValue(row, ['Subject Code', 'subject code', 'Code', 'code', 'Subject_Code', 'SubjectCode']);
      const subjectName = getValue(row, ['Subject Name', 'subject name', 'Name', 'name', 'Subject_Name', 'SubjectName', 'Subject']);
      const credits = getValue(row, ['Credits', 'credits', 'Credit', 'credit']);
      
      if (branch) branches.add(branch);
      if (basket) baskets.add(basket);
      if (subjectCode) subjectCodes.add(subjectCode.toUpperCase());
      
      // Try to parse credits
      if (credits) {
        const creditStr = String(credits);
        const creditMatch = creditStr.match(/(\d+(?:\.\d+)?)/);
        if (creditMatch) {
          totalCredits += parseFloat(creditMatch[1]);
        }
      }
      
      // Check for invalid rows (missing critical data)
      if (!branch || !basket || !subjectCode) {
        invalidRows++;
        if (invalidRows <= 5) {
          console.log(`   ⚠️  Row ${idx + 2}: Missing critical data`);
          console.log(`      Branch: ${branch || 'MISSING'}, Basket: ${basket || 'MISSING'}, Subject Code: ${subjectCode || 'MISSING'}`);
          console.log(`      Available keys: ${Object.keys(row).join(', ')}`);
        }
      }
    });
    
    console.log(`\n📊 Data Summary:`);
    console.log(`   • Unique Branches: ${branches.size} - ${Array.from(branches).slice(0, 10).join(', ')}${branches.size > 10 ? '...' : ''}`);
    console.log(`   • Unique Baskets: ${baskets.size} - ${Array.from(baskets).join(', ')}`);
    console.log(`   • Unique Subject Codes: ${subjectCodes.size}`);
    console.log(`   • Total Credits (sum): ${totalCredits.toFixed(2)}`);
    console.log(`   • Invalid Rows: ${invalidRows} (${((invalidRows / data.length) * 100).toFixed(1)}%)`);
    
    // Check basket distribution
    const basketCount = {};
    data.forEach(row => {
      const basket = row['Basket'] || row['basket'] || '';
      if (basket) {
        basketCount[basket] = (basketCount[basket] || 0) + 1;
      }
    });
    
    if (Object.keys(basketCount).length > 0) {
      console.log(`\n📦 Basket Distribution:`);
      Object.entries(basketCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([basket, count]) => {
          console.log(`   • ${basket}: ${count} subjects`);
        });
    }
    
    // Check branch distribution
    const branchCount = {};
    data.forEach(row => {
      const branch = row['Branch'] || row['branch'] || '';
      if (branch) {
        branchCount[branch] = (branchCount[branch] || 0) + 1;
      }
    });
    
    if (Object.keys(branchCount).length > 0) {
      console.log(`\n🏛️  Branch Distribution:`);
      Object.entries(branchCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([branch, count]) => {
          console.log(`   • ${branch}: ${count} subjects`);
        });
    }
    
    // Sample data - show full row structure
    console.log(`\n📝 Sample Data (first 5 rows with all columns):`);
    data.slice(0, 5).forEach((row, idx) => {
      console.log(`\n   Row ${idx + 1}:`);
      Object.entries(row).forEach(([key, value]) => {
        const valStr = String(value || '').substring(0, 50);
        console.log(`      "${key}": ${valStr || '(empty)'}`);
      });
    });
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Analysis Complete!');
  
} catch (error) {
  console.error('❌ Error analyzing file:', error.message);
  console.error(error.stack);
  process.exit(1);
}


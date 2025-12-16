import jsPDF from "jspdf";
import "jspdf-autotable";

/** 📄 Export result as PDF */
export function exportAsPDF(result) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(`Result Summary for ${result.registration}`, 14, 15);
  doc.setFontSize(12);
  doc.text(`Overall CGPA: ${result.cgpa}`, 14, 25);

  result.semesters.forEach((sem, index) => {
    doc.text(`${sem.sem}  —  SGPA: ${sem.sgpa}`, 14, 35 + index * 10);
    const tableRows = sem.subjects.map((s) => [
      s.Subject_Code,
      s.Subject_Name,
      s.Credits,
      s.Grade,
    ]);
    doc.autoTable({
      head: [["Subject Code", "Subject Name", "Credits", "Grade"]],
      body: tableRows,
      startY: 40 + index * 50,
      theme: "grid",
      styles: { fontSize: 9 },
    });
  });

  doc.save(`${result.registration}_result.pdf`);
}

/** 📊 Export result as CSV */
export function exportAsCSV(result) {
  let csv = `Registration,${result.registration}\nOverall CGPA,${result.cgpa}\n\n`;

  result.semesters.forEach((sem) => {
    csv += `${sem.sem} (SGPA: ${sem.sgpa})\n`;
    csv += "Subject Code,Subject Name,Credits,Grade\n";
    sem.subjects.forEach((s) => {
      csv += `${s.Subject_Code},"${s.Subject_Name}",${s.Credits},${s.Grade}\n`;
    });
    csv += "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${result.registration}_result.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

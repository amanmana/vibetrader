const fs = require('fs');

function removeTP(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Regex to remove <th> containing TP3 or TP4 (single line and multi-line)
  // E.g., <th ...>TP3...</th>
  // Be careful with newlines inside th. But most are on one or two lines.
  
  // A safer approach: line-by-line or specific regex
  content = content.replace(/<th[^>]*>TP[34][\s\S]*?<\/th>/g, '');
  
  // For the Custom Master List td (multi-line)
  // It looks like:
  // <td className={`p-4`}>
  //   <div className="flex flex-col gap-1">
  //     <div className="flex items-center gap-1.5">
  //       <div className={`w-1.5 h-1.5 rounded-full ${...TP[34]Color...}`} />
  //       <span className={`...`}>{row.staticTP[34]}</span>
  // ...
  // </td>
  
  // This is tricky. Let's do something simpler: I'll use standard file replacing.
}

removeTP('src/app/bursa/page.tsx');

import path from "node:path";

export function safeJoin(base, inputs) {

  if (typeof base != 'string' || base.length == 0 || !Array.isArray(inputs) ) {
    throw new Error(`safeJoin: Illegal path name: ${base} ; ${inputs} `);
  }
  
  let valid = true;
  const pathLegs = [base, ...inputs];

  // check for string type
  valid = pathLegs.reduce(
            (prevValid, leg) => (prevValid && (typeof leg == 'string')),
            valid
          );
  if (!valid) {
    throw new Error('safeJoin: Illegal path name: ' + pathLegs.toString() );
  }  
  
  // check for '..'
  valid = pathLegs.reduce(
            (prevValid, leg) => prevValid && !leg.includes('..'),
            valid
          );
  if (!valid) {
    throw new Error('safeJoin: Illegal path name: ' + pathLegs.toString() );
  }  
  
  // check for invalid strings (empty or with invalid characters)
  valid = pathLegs.reduce(
            (prevValid, leg) => prevValid && ( leg.length > 0 || (leg.match('[/?.%*:|<>",;=]') === null) ),
            valid
          );
  if (!valid) {
    throw new Error('safeJoin: Illegal path name: ' + pathLegs.toString() );
  }  
   
  const newPath = path.resolve(base, ...inputs);
  if (!newPath.startsWith(base)) {
    throw new Error('safeJoin: Illegal path name: ' + base + " ; " + inputs.toString());
  }
  else {
    return newPath;
  }
};

export function safePath(filePath) {

  // check for string type
  if (typeof filePath != 'string') {
    throw new Error('safePath: Illegal path name: ' + filePath );
  }  
  
  // check for '..'
  if (filePath.includes('..')) {
    throw new Error('safePath: Illegal path name: ' + filePath) ;
  }  
  
  // check for invalid strings (empty or with invalid characters)
  if (filePath == '' || (filePath.match('[?%*:|<>",;=]') !== null)) {
    throw new Error('safePath: Illegal path name: ' + filePath );
  }  

  return filePath;  
}

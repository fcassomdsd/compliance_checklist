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

  if (filePath == '' ) {
    throw new Error('safePath: Empty path detected: ' + filePath);  
  }

  // parse the path for it's components
  const pathObj = path.parse(filePath);
  
  // check the root.  That depends on the operating system
  if (path.sep == '/') {
    if (pathObj.root != '/') {
      throw new Error('safePath: Not absolute path: ' + filePath );
    }
  }
  else {
    if (!pathObj.root.match(/^[A-Z]:\\$/)) {
      throw new Error('safePath: Not absolute path: ' + filePath );
    }
  }
  
  const pathRemainder = filePath.substring(pathObj.root.length);
  
  // check for '..'
  if (pathRemainder.includes('..')) {
    throw new Error('safePath: Illegal path name: ' + filePath) ;
  }  
  
  // check for invalid characters
  if (pathRemainder.match('[?%*:|<>",;=]') !== null) {
    throw new Error('safePath: Illegal path name: ' + filePath );
  }  

  return filePath;  
}

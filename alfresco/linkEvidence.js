// link files specified in the json file from a base directory to a specific directory in a specified space
// resulting file links: XXX-Pyyy-zz-dddd
//    where:
//        XXX is a prefix depending on the specialty (the name of the current space)
//        yyy is the question number the files correspond to
//        zz is a sequential number among the files of the same question
//        dddd is the file name
// the directory structure is assumed as follows:
//   XXX
//     -> Evidence
//         -> <files>
//     -> Links
//         -> <links to files>
// the json file is called session.json.  The structure of the JSON file is as follows:
// {
//   "yyy": {
//        "evidence": [ "dddd1", "dddd2",...]
//    }
// }
//
const baseDir = document.parent
const filesDir = baseDir.childByNamePath('Evidencias')
const linksDir = baseDir.childByNamePath('Enlaces')

const filePrefix = baseDir.name
const sessionJSON = JSON.parse(baseDir.childByNamePath('session.json').content, (key, value) =>
  typeof value == 'object' && 'evidence' in value ? linkFileArray(key, value.evidence) : value
)

function linkFileArray(qnumber, listOfFiles) {
  listOfFiles.map((x, index) => linkFile(x, qnumber, index + 1))

  return listOfFiles
}

function linkFile(fileName, qnumber, seq) {
  const sourceDocument = filesDir.childByNamePath(fileName)
  var properties = []
  properties['cm:name'] =
    filePrefix +
    '-P' +
    qnumber.toString().padStart(3, '0') +
    '-' +
    seq.toString().padStart(2, '0') +
    '-' +
    fileName
  properties['cm:destination'] = sourceDocument

  const targetDocument = linksDir.childByNamePath(properties['cm:name'])

  if (!targetDocument) {
    var linkNode = linksDir.createNode(
      properties['cm:name'],
      '{http://www.alfresco.org/model/application/1.0}filelink',
      properties
    )

    linkNode.save() // Save the newly created link node

    if (!sourceDocument.hasAspect('app:linked')) {
      sourceDocument.addAspect('app:linked')
      sourceDocument.save()
    }

    return properties['cm:name']
  } else {
    return null
  }
}

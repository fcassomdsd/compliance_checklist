import PDFDocument from 'pdfkit'
import fs from 'fs'

/**
 * Generate a PDF report for findings (non-compliant items)
 * @param {Object} params - Parameters for PDF generation
 * @param {Object} params.checklist - Checklist data containing questions and metadata
 * @param {Object} params.session - Session responses data
 * @param {string} params.specialty - Specialty name
 * @param {string} params.outputPath - Path where to save the PDF
 */
export function generateFindingsReport({ checklistString, sessionString, outputPath }) {
    const SIDE_MARGIN = 50
    const BOTTOM_MARGIN = 40
  return new Promise((resolve, reject) => {
    try {
 
      // Parse JSON strings to objects first
      const checklist = JSON.parse(checklistString)
      const session = JSON.parse(sessionString)

      // Create PDF document
      const doc = new PDFDocument({
        size: 'LETTER',
        bufferPages : true,
        margins: { top: 170, bottom: BOTTOM_MARGIN, left: SIDE_MARGIN, right: SIDE_MARGIN }
      })

      // Create write stream
      const stream = fs.createWriteStream(outputPath)
      doc.pipe(stream)

      // Collect non-compliant findings
      const findings = []
      const validCompliance = ['Non-compliant']
      const validQuestions = checklist.questions.entries()

      for (const [index, row] of validQuestions) {
        if (
          session.responses[index + 1] !== undefined &&
          validCompliance.includes(session.responses[index + 1].compliance)
        ) {
          const qnumber = index + 1
          const sessionData = session.responses[qnumber] || {}
          findings.push({
            number: qnumber,
            reference: row.reference || '',
            question: row.question || '',
            topic: row.topic || '',
            nonConformity: sessionData.nonConformity || '',
            comments: sessionData.comments || '',
          })
        }
      }

      // If no findings, add note
      if (findings.length === 0) {
        doc.fontSize(11).font('Helvetica').text('No se encontraron hallazgos durante esta inspección.')
        doc.moveDown(2)
      } else {
        // Table rows
        const tableData = findings.map( (x) => [
            x.reference,
            x.number.toString(),
            x.question,
            x.nonConformity,
            x.comments
        ])
 
        doc.font('Times-Roman').fontSize(10)
        doc.table({
            position: {x: SIDE_MARGIN, y: doc.y},
            columnStyles : [
                { width : 120 }, 
                { width: 20, align : 'center' }, 
                { width: 140 }, 
                { width: '*' }, 
                { width: '*' }
            ],
            data : tableData
        })

      }

      // general comments
      doc.moveDown(1)
      doc.font('Times-Roman')
      doc.fontSize(12).text(
        `Comentarios Generales: *** ${session.summary.generalComments || 'Ninguno'} ***`
      )      
      
      // End of findings note
      doc.font('Helvetica-Bold')
      doc.fontSize(10).text('________________________________________________________________', {align : 'center'})
      doc.fontSize(10).text('Fin de los hallazgos', {align : 'center'})
      doc.moveDown(0.5)
      doc.font('Helvetica')

      doc.font('Helvetica')
      doc.fontSize(10).text(
        `Nota: del total de ${checklist.questions.length} preguntas del protocolo utilizado en la inspección, ` +
          `aquellas que no aparecen en la relación anterior fueron respondidas de manera satisfactoria.`
      )

      // Signature section on new page if there are findings
      if (findings.length > 0) {

        // Signature lines
        doc.fontSize(10).font('Times-Roman')
        doc.moveDown(5)
        doc.table(
            {
                defaultStyle: {
                    align : { x : 'center'},
                    border : false
                },
                columnStyles: [
                    { width : '*'},
                    { width : 200, border : { top : true } },
                    { width : '*'},
                    { width : 200, border : { top : true } },
                    { width : '*'},
                ],
                rowStyles: { height : 50, align : { y : 'top' } }
            }
        )
          .row(['', 'Inspector actuante', '', 'Inspector actuante' ,''])
          .row(['', 'Contraparte inspeccionada', '', 'Contraparte inspeccionada' ,''])
          .row(['', 'Contraparte inspeccionada', '', 'Contraparte inspeccionada' ,''])
      }

      // --- THE HEADER/FOOTER LOOP ---
      // This happens AFTER all content is added, but BEFORE doc.end()
      const range = doc.bufferedPageRange(); // returns { start: 0, count: X }

      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Save state (so header styles don't leak into your content)
        doc.save();

        // --- Header ---
        doc.image('src/images/compliance-logo.png', SIDE_MARGIN, 40, { fit : [80,110] })
        doc.fontSize(10).font('Helvetica')
        doc.table(
          { 
              position : { x: SIDE_MARGIN, y: 40 },
              columnStyles : [
                  { border : true}, 
                  { border : false, width : 320}, 
                  { border : true }
              ] 
          },
        )
          .row([{
                rowSpan : 3,
//                image : 'src/images/compliance-logo.png',
                border : 1
              }, 
              { 
                align: { x: 'center', y : 'top'},
                border : { top : 1 },  
                text: 'DIRECCIÓN DE VIGILANCIA DE LA SEGURIDAD OPERACIONAL'
              },
              {
                text : 'Version: 1.0',
                border : { top : 1 },
                align: { x: 'right', y : 'top'}
              }
            ])
          .row([{
            align: { x: 'center', y : 'top'}, 
            text: 'DEPARTAMENTO DE VIGILANCIA SNA/AGA'
          },
          {
            text : `Emisión: ${new Date().toISOString().split('T')[0]}`,
            font : { size: 9 },
            align: { x: 'right', y : 'top'}
          }])
          .row([{
            align: { x: 'center', y : 'top'}, 
            text: 'Reporte de Hallazgos',
            border : { bottom : 1 },
            font : {size: 14}
          },{
            text : `Página ${i + 1} de ${range.count}`,
            border : { bottom : 1 },
            align: { x: 'right', y : 'top'}
          }])
        doc.moveDown(0.5)

        // Inspection details

        // Row 1: Inspección and Fecha
        doc
          .font('Times-Bold')
          .text('Inspección', SIDE_MARGIN, doc.y)
          .moveUp()
          .text('Fecha', 340, doc.y)
        doc
          .font('Times-Roman')
          .moveUp()
          .text(`: ${checklist.inspection.trim() || ''}`, 140, doc.y)
          .moveUp()
          .text(`: ${checklist.startDate.trim()}`, 440, doc.y)
      
        // Row 2: Localidad and Especialidad
        doc
          .font('Times-Bold')
          .text('Localidad', SIDE_MARGIN, doc.y)
          .moveUp()
          .text('Especialidad', 340, doc.y)
        doc
          .font('Times-Roman')
          .moveUp()
          .text(`: ${checklist.location.trim() || ''}`, 140, doc.y)
          .moveUp()
          .text(`: ${checklist.specialtyName.trim() || ''}`, 440, doc.y)
        doc.moveDown(2)

        doc.font('Times-Roman')
        doc.table({
          position : { x: SIDE_MARGIN, y: doc.y },
          columnStyles : [120,20,140,'*','*'],
          rowStyles: { align: 'center', font : { src : 'Times-Bold'} },
          data : [
              ['Referencia', 'No.', 'Pregunta', 'No conformidad', 'Comentario']
          ]
        })

        // Restore state
        doc.restore();
      }

      // Finalize PDF
      doc.end()

      // Resolve when stream finishes
      stream.on('finish', () => {
        resolve(outputPath)
      })

      stream.on('error', (error) => {
        reject(error)
      })

    } catch (error) {
      reject(error)
    }
  })}


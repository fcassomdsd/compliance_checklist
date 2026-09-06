import PDFDocument from 'pdfkit'
import fs from 'fs'

// English labels are authored here from scratch — the original report was
// Spanish-only with no English baseline to translate from.
const LABELS = {
  es: {
    noFindings: 'No se encontraron hallazgos durante esta inspección.',
    generalComments: 'Comentarios Generales',
    none: 'Ninguno',
    endOfFindings: 'Fin de los hallazgos',
    footnote: (total) =>
      `Nota: del total de ${total} preguntas del protocolo utilizado en la inspección, ` +
      `aquellas que no aparecen en la relación anterior fueron respondidas de manera satisfactoria.`,
    signatureInspector: 'Inspector actuante',
    signatureCounterpart: 'Contraparte inspeccionada',
    entityHeaderLine1: 'DIRECCIÓN DE VIGILANCIA DE LA SEGURIDAD OPERACIONAL',
    entityHeaderLine2: 'DEPARTAMENTO DE VIGILANCIA SNA/AGA',
    reportTitle: 'Reporte de Hallazgos',
    version: (v) => `Versión: ${v}`,
    issued: (date) => `Emisión: ${date}`,
    page: (current, total) => `Página ${current} de ${total}`,
    inspection: 'Inspección',
    date: 'Fecha',
    location: 'Localidad',
    specialty: 'Especialidad',
    tableReference: 'Referencia',
    tableCode: 'Codigo',
    tableQuestion: 'Pregunta',
    tableNonConformity: 'No conformidad',
    tableComment: 'Comentario',
    nominalRisk: 'Riesgo Nominal',
    assignedRisk: 'Riesgo Asignado',
    description: 'Descripción',
  },
  en: {
    noFindings: 'No findings were identified during this inspection.',
    generalComments: 'General Comments',
    none: 'None',
    endOfFindings: 'End of findings',
    footnote: (total) =>
      `Note: of the ${total} total questions in the protocol used for this inspection, ` +
      `those not listed above were answered satisfactorily.`,
    signatureInspector: 'Inspector on duty',
    signatureCounterpart: 'Inspected counterpart',
    entityHeaderLine1: 'DIRECTORATE OF OPERATIONAL SAFETY OVERSIGHT',
    entityHeaderLine2: 'SNA/AGA OVERSIGHT DEPARTMENT',
    reportTitle: 'Findings Report',
    version: (v) => `Version: ${v}`,
    issued: (date) => `Issued: ${date}`,
    page: (current, total) => `Page ${current} of ${total}`,
    inspection: 'Inspection',
    date: 'Date',
    location: 'Location',
    specialty: 'Specialty',
    tableReference: 'Reference',
    tableCode: 'Code',
    tableQuestion: 'Question',
    tableNonConformity: 'Non-conformity',
    tableComment: 'Comment',
    nominalRisk: 'Nominal Risk',
    assignedRisk: 'Assigned Risk',
    description: 'Description',
  },
}

function resolveLabels(locale) {
  return LABELS[locale] || LABELS.es
}

/**
 * Generate a PDF report for findings (non-compliant items)
 * @param {Object} params - Parameters for PDF generation
 * @param {Object} params.checklist - Checklist data containing questions and metadata
 * @param {Object} params.session - Session responses data
 * @param {string} params.specialty - Specialty name
 * @param {string} params.outputPath - Path where to save the PDF
 * @param {string} [params.locale] - 'en' or 'es'; defaults to 'es' (the report's original language)
 */
export function generateFindingsReport({ checklistString, sessionString, outputPath, locale }) {
    const SIDE_MARGIN = 50
    const BOTTOM_MARGIN = 40
    const L = resolveLabels(locale)
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

      const getQuestionCode = (row, index) => row?.code || String(index + 1)
      const findResponseForRow = (row, index) => {
        const questionCode = getQuestionCode(row, index)
        const byCode = session.responses?.[questionCode]
        if (byCode) {
          return byCode
        }

        const byIndex = session.responses?.[index + 1] || session.responses?.[String(index + 1)]
        if (byIndex) {
          return byIndex
        }

        return Object.values(session.responses || {}).find(
          (entry) => entry?.id === row?.id || entry?.code === row?.code
        )
      }

      const normalizeRiskLevel = (value) =>
        ['Low', 'Medium', 'High', 'Critical'].includes(value) ? value : 'Low'

      // Collect non-compliant findings
      const findings = []
      const validCompliance = ['Non-Compliant']
      const validQuestions = checklist.questions.entries()

      for (const [index, row] of validQuestions) {
        const response = findResponseForRow(row, index)
        if (
          response !== undefined &&
          validCompliance.includes(response.compliance)
        ) {
          const questionCode = getQuestionCode(row, index)
          const sessionData = response || {}
          const normativa = row.reference?.normativa
          const normativaText = normativa
            ? [normativa.reglamento, normativa.articulo].filter(Boolean).join(' ')
            : ''
          const guidanceText = row.reference?.guidance || ''
          const referenceText = [normativaText, guidanceText].filter(Boolean).join('\n')
          const nominalRisk = normalizeRiskLevel(row?.riskLevel)
          const assignedRisk = normalizeRiskLevel(sessionData.nonConformityDetails?.riskLevel || row?.riskLevel)
          const description = sessionData.nonConformityDetails?.description || ''
          findings.push({
            code: questionCode,
            reference: referenceText,
            question: row.question || '',
            topic: row.topic || '',
            nonConformity: `${L.nominalRisk}: ${nominalRisk}\n${L.assignedRisk}: ${assignedRisk}\n${L.description}: ${description}`,
            comments: sessionData.comments || '',
          })
        }
      }

      // If no findings, add note
      if (findings.length === 0) {
        doc.fontSize(11).font('Helvetica').text(L.noFindings)
        doc.moveDown(2)
      } else {
        // Table rows
        const tableData = findings.map( (x) => [
            x.reference,
          x.code,
            x.question,
            x.nonConformity,
            x.comments
        ])

        doc.font('Times-Roman').fontSize(10)
        doc.table({
            position: {x: SIDE_MARGIN, y: doc.y},
            columnStyles : [
                { width : 120 },
                { width: 40, align : 'center' },
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
        `${L.generalComments}: *** ${session.summary.generalComments || L.none} ***`
      )

      // End of findings note
      doc.font('Helvetica-Bold')
      doc.fontSize(10).text('________________________________________________________________', {align : 'center'})
      doc.fontSize(10).text(L.endOfFindings, {align : 'center'})
      doc.moveDown(0.5)
      doc.font('Helvetica')

      doc.font('Helvetica')
      doc.fontSize(10).text(L.footnote(checklist.questions.length))

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
          .row(['', L.signatureInspector, '', L.signatureInspector ,''])
          .row(['', L.signatureCounterpart, '', L.signatureCounterpart ,''])
          .row(['', L.signatureCounterpart, '', L.signatureCounterpart ,''])
      }

      // --- THE HEADER/FOOTER LOOP ---
      // This happens AFTER all content is added, but BEFORE doc.end()
      const range = doc.bufferedPageRange(); // returns { start: 0, count: X }

      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

        // Save state (so header styles don't leak into your content)
        doc.save();

        // --- Header ---
        doc.image('./public/images/compliance-logo.png', SIDE_MARGIN, 40, { fit : [80,110] })
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
                border : 1
              },
              {
                align: { x: 'center', y : 'top'},
                border : { top : 1 },
                text: L.entityHeaderLine1
              },
              {
                text : L.version('1.0'),
                border : { top : 1 },
                align: { x: 'right', y : 'top'}
              }
            ])
          .row([{
            align: { x: 'center', y : 'top'},
            text: L.entityHeaderLine2
          },
          {
            text : L.issued(new Date().toISOString().split('T')[0]),
            font : { size: 9 },
            align: { x: 'right', y : 'top'}
          }])
          .row([{
            align: { x: 'center', y : 'top'},
            text: L.reportTitle,
            border : { bottom : 1 },
            font : {size: 14}
          },{
            text : L.page(i + 1, range.count),
            border : { bottom : 1 },
            align: { x: 'right', y : 'top'}
          }])
        doc.moveDown(0.5)

        // Inspection details

        // Row 1: Inspección and Fecha
        doc
          .font('Times-Bold')
          .text(L.inspection, SIDE_MARGIN, doc.y)
          .moveUp()
          .text(L.date, 340, doc.y)
        doc
          .font('Times-Roman')
          .moveUp()
          .text(`: ${checklist.inspection.trim() || ''}`, 140, doc.y)
          .moveUp()
          .text(`: ${checklist.startDate.trim()}`, 440, doc.y)

        // Row 2: Localidad and Especialidad
        doc
          .font('Times-Bold')
          .text(L.location, SIDE_MARGIN, doc.y)
          .moveUp()
          .text(L.specialty, 340, doc.y)
        doc
          .font('Times-Roman')
          .moveUp()
          .text(`: ${(checklist.locationName || checklist.location || '').trim()}`, 140, doc.y)
          .moveUp()
          .text(`: ${checklist.specialtyName.trim() || ''}`, 440, doc.y)
        doc.moveDown(2)

        doc.font('Times-Roman')
        doc.table({
          position : { x: SIDE_MARGIN, y: doc.y },
          columnStyles : [120,40,140,'*','*'],
          rowStyles: { align: 'center', font : { src : 'Times-Bold'} },
          data : [
              [L.tableReference, L.tableCode, L.tableQuestion, L.tableNonConformity, L.tableComment]
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

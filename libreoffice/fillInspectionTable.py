import uno
import os
import json
from urllib.parse import urlparse, unquote, urlunparse
from com.sun.star.beans import PropertyValue
import msgbox

def url_to_path(url):
    parsed = urlparse(url)
    path = unquote(parsed.path)
    return path

def make_pdf(documento):
    properties=[] 
    p=PropertyValue() 
    p.Name='FilterName' 
    p.Value='writer_pdf_Export' 
    properties.append(p)
    parsed = urlparse(documento.getURL())
    unparsed = parsed._replace(path=os.path.join(os.path.dirname(parsed.path), "Protocolo_completado.pdf"))
    filename = urlunparse(unparsed) 
    documento.storeToURL(filename,tuple(properties))

def show_message(message, title="Info", buttons=0):
    myBox = msgbox.MsgBox(uno.getComponentContext())
    myBox.addButton("okay")
    #myBox.renderFromButtonSize()
    print(myBox.show(message, buttons, title))

def read_text_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def fill_inspection_table():
        #try:
        doc = XSCRIPTCONTEXT.getDocument()
        if doc is None:
            show_message("No document open", "Error")
            return
        tables = doc.getTextTables()
        if tables.getCount() == 0:
            show_message("No tables in document", "Error")
            return
        table = tables.getByIndex(0)
        columns = table.getColumns()
        if columns.getCount() < 5:
            show_message("Table must have at least 5 columns", "Error")
            return
        rows = table.getRows()
        # Get directory path
        doc_url = doc.getURL()
        dir_path = os.path.dirname(url_to_path(doc_url))
        checklist_path = os.path.join(dir_path, "checklist.json")
        session_path = os.path.join(dir_path, "session.json")
        if not os.path.exists(checklist_path) or not os.path.exists(session_path):
            show_message("JSON file(s) not found", "Error")
            return
        checklist_text = read_text_file(checklist_path)
        session_text = read_text_file(session_path)
        checklist = json.loads(checklist_text)
        if "questions" not in checklist:
            show_message("Invalid checklist.json: 'questions' not found", "Error")
            return
        questions = checklist["questions"]
        session = json.loads(session_text)
        seq_no = 1
        rownum = 1
        current_topic = ""
        for q in questions:
            if "id" not in q or "reference" not in q or "question" not in q:
                show_message("Invalid question data", "Error")
                return
            # Insert a merged row for a new topic if applicable
            if q["topic"] != current_topic:
                current_topic = q["topic"]
                if rownum >= rows.getCount():
                    rows.insertByIndex(rows.getCount(), 2)
                # Merge cells for the new topic
                #cell_range = table.getCellRangeByPosition(0, rownum, columns.getCount() - 1, rownum)
                # Write and format the topic text
                topic_cell = table.getCellByPosition(0, rownum)
                tableCursor = table.createCursorByCellName(topic_cell.CellName)                
                tableCursor.goRight(4,"true")
                tableCursor.mergeRange()
                tableCursor.setPropertyValue("BackColor", 0xAAAAFF)
                tableCursor.CharWeight = 150.0000
                topic_cell.setString(current_topic)
                rownum += 1
            else:
                if rownum > rows.getCount() - 1:
                    rows.insertByIndex(rows.getCount(), 1)
            id_ = str(seq_no) #str(q["id"])  # Ensure string for key matching
            reference = q["reference"]
            question = q["question"]
            compliance = ""
            comments = ""
            if id_ in session:
                item = session[id_]
                compliance = item.get("compliance", "")
                comments = item.get("comments", "")
            # Add row if needed
            # Fill cells
            match compliance:
                case "Non-compliant":
                    bcolor = 0xFF5555
                case "Compliant":
                    bcolor = 0x55FF55
                case "Partial Compliance":
                    bcolor = 0xFFFF00
                case "Not applicable":
                    bcolor = 0xAAAAAA
                case _:
                    bcolor = 0xFFFFFF

            tableCursor = table.createCursorByCellName(table.getCellByPosition(2, rownum).CellName)
            tableCursor.ParaAdjust = 0

            tableCursor = table.createCursorByCellName(table.getCellByPosition(4, rownum).CellName)
            tableCursor.ParaAdjust = 0

            table.getCellByPosition(0, rownum).setString(reference)
            table.getCellByPosition(1, rownum).setString(str(seq_no))
            table.getCellByPosition(2, rownum).setString(question)
            table.getCellByPosition(3, rownum).setString(compliance)
            table.getCellByPosition(4, rownum).setString(comments)

            table.getCellByPosition(0, rownum).setPropertyValue("BackColor", 0xFFFFFF)
            table.getCellByPosition(3, rownum).setPropertyValue("BackColor", bcolor)

            seq_no += 1
            rownum += 1
        make_pdf(doc)
        show_message("Table filled successfully.", "Success")
        #except Exception as e:
        #show_message(e, "Error")
        #return

def main():
    fill_inspection_table()

g_exportedScripts = (main,)
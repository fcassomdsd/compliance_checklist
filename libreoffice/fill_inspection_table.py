import os
import json
from urllib.parse import urlparse, unquote, urlunparse
from com.sun.star.beans import PropertyValue
import uno
import msgbox

# constants
COL_REFERENCE = 0
COL_NUMBER = 1
COL_QUESTION = 2
COL_COMPLIANCE = 3
COL_COMMENTS = 4


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
    new_path = os.path.join(os.path.dirname(parsed.path), "Protocolo_completado.pdf")
    unparsed = parsed._replace(path=new_path)
    filename = urlunparse(unparsed)
    documento.storeToURL(filename,tuple(properties))
    return 1

def show_message(message, title="Info", buttons=0):
    my_box = msgbox.MsgBox(uno.getComponentContext())
    my_box.addButton("okay")
    #my_box.renderFromButtonSize()
    print(my_box.show(message, buttons, title))

def read_json_file(filepath, key_to_check=None):
    """
    Reads and parses a JSON file, returning its content.
    Includes robust error handling for file not found or invalid JSON.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Error: JSON file not found at {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if key_to_check and key_to_check not in data:
            err = f"Error: Invalid JSON format in {filepath}. '{key_to_check}' key is missing."
            raise AttributeError(err)
        return data

def fill_table_row(table, row, question_data, session_data, sequence):
    reference = question_data["reference"]
    question = question_data["question"]
    compliance = ""
    comments = ""
    compliance = session_data.get("compliance", "")
    comments = session_data.get("comments", "")

    # format cells before filling in text
    cell_question = table.getCellByPosition(COL_QUESTION, row)
    table_cursor = table.createCursorByCellName(cell_question.CellName)
    table_cursor.ParaAdjust = 0
    cell_comments = table.getCellByPosition(COL_COMMENTS, row)
    table_cursor = table.createCursorByCellName(cell_comments.CellName)
    table_cursor.ParaAdjust = 0

    # color cell backgrounds.
    match compliance:
        case "Non-Compliant":
            bcolor = 0xFF5555
        case "Compliant":
            bcolor = 0x55FF55
        case "Partial Compliance":
            bcolor = 0xFFFF00
        case "Not applicable":
            bcolor = 0xAAAAAA
        case _:
            bcolor = 0xFFFFFF
    table.getCellByPosition(COL_REFERENCE, row).setPropertyValue("BackColor", 0xFFFFFF)
    table.getCellByPosition(COL_COMPLIANCE, row).setPropertyValue("BackColor", bcolor)

    # Fill cells
    table.getCellByPosition(COL_REFERENCE, row).setString(reference)
    table.getCellByPosition(COL_NUMBER, row).setString(str(sequence))
    cell_question.setString(question)
    table.getCellByPosition(COL_COMPLIANCE, row).setString(compliance)
    cell_comments.setString(comments)

def get_table_from_doc(doc):

    if doc is None:
        raise OSError("No document open")

    if doc.getTextTables().getCount() == 0:
        raise LookupError("No tables in document")

    table = doc.getTextTables().getByIndex(0)
    if table.getColumns().getCount() < 5:
        raise AttributeError("Table must have at least 5 columns")
    return table

def fill_inspection_table(doc):
        #try:
        table = get_table_from_doc(doc)
        rows = table.getRows()

        # Get directory path
        dir_path = os.path.dirname(url_to_path(doc.getURL()))

        # read JSON files
        checklist = read_json_file(os.path.join(dir_path, "checklist.json"), "questions")
        session = read_json_file(os.path.join(dir_path, "session.json"))

        # initialize variables for main loop
        questions = checklist["questions"]
        seq_no = 1  # sequence number for the questions
        rownum = 1  # table row number.  can be different from seq_no due to topic title rows
        current_topic = ""

        # erase any previous table contents
        if rows.getCount() > 1:
            rows.removeByIndex(1, rows.getCount() - 1)

        for q in questions:
            if "id" not in q or "reference" not in q or "question" not in q:
                raise AttributeError("Invalid question data")

            # Insert a merged row for a new topic if applicable
            if q["topic"] != current_topic:

                current_topic = q["topic"]

                # Insert the row for the topic and the next data row BEFORE merging.
                if rownum >= rows.getCount():
                    rows.insertByIndex(rows.getCount(), 2)

                # Merge cells for the new topic
                topic_cell = table.getCellByPosition(COL_REFERENCE, rownum)
                table_cursor = table.createCursorByCellName(topic_cell.CellName)
                table_cursor.goRight(COL_COMMENTS,"true")
                table_cursor.mergeRange()

                # Write and format the topic text
                table_cursor.setPropertyValue("BackColor", 0xAAAAFF)
                table_cursor.CharWeight = 150.0000
                topic_cell.setString(current_topic)

                rownum += 1

            else:
                # Just insert the new data row, if needed
                if rownum > rows.getCount() - 1:
                    rows.insertByIndex(rows.getCount(), 1)

            # get data for row
            id_ = str(seq_no) #str(q["id"])  # Ensure string for key matching
            if id_ in session:
                item = session[id_]
            else:
                item = {}

            #fila = table.getCellRangeByPosition(COL_REFERENCE, rownum, COL_COMMENTS, rownum)
            fill_table_row(table, rownum, q, item, seq_no)

            # next!
            seq_no += 1
            rownum += 1

        return 1
        #except Exception as e:
        #show_message(e, "Error")
        #return None

def main():
    doc = XSCRIPTCONTEXT.getDocument()
    if fill_inspection_table(doc):
        if make_pdf(doc):
            show_message("Table filled successfully.", "Success")

g_exportedScripts = (main,)

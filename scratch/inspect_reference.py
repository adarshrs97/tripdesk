import zipfile
import xml.etree.ElementTree as ET
import os

wb_path = os.path.join("reference", "Log book VTL Aug 2027.xlsx")
wb = zipfile.ZipFile(wb_path)

# Read shared strings
shared_strings = []
if "xl/sharedStrings.xml" in wb.namelist():
    sst_root = ET.fromstring(wb.read("xl/sharedStrings.xml"))
    for si in sst_root.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
        # can contain <t> or <r><t>
        texts = [t.text or "" for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")]
        shared_strings.append("".join(texts))

print(f"Total shared strings: {len(shared_strings)}")

# Map sheet names to target xml
wb_root = ET.fromstring(wb.read("xl/workbook.xml"))
rels_root = ET.fromstring(wb.read("xl/_rels/workbook.xml.rels"))

rel_map = {}
for rel in rels_root.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
    rel_map[rel.attrib["Id"]] = rel.attrib["Target"]

sheets_info = []
for s in wb_root.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"):
    name = s.attrib["name"]
    rId = s.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
    target = rel_map[rId]
    if not target.startswith("xl/"):
        target = "xl/" + target
    sheets_info.append((name, target))

print("Sheets:", sheets_info)

def parse_sheet(target_path, max_rows=40):
    root = ET.fromstring(wb.read(target_path))
    rows_data = []
    rows = root.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row")
    for r in rows[:max_rows]:
        row_num = r.attrib.get("r", "")
        cells = {}
        for c in r.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
            cell_ref = c.attrib.get("r", "")
            cell_type = c.attrib.get("t", "")
            v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
            val = v.text if v is not None else ""
            if cell_type == "s" and val.isdigit():
                val = shared_strings[int(val)]
            cells[cell_ref] = val
        rows_data.append((row_num, cells))
    return rows_data

for name, target in sheets_info:
    print(f"\n================ SHEET: {name} ({target}) ================")
    rows = parse_sheet(target, 45)
    for r_num, cells in rows:
        items = [f"{col}:{val}" for col, val in cells.items() if val != ""]
        if items:
            print(f"Row {r_num}: " + " | ".join(items))

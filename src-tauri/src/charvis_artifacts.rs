//! Bounded Office document generation. No scripts, macros, external references or model paths.
use serde_json::{json, Value};
use std::{
    fs,
    io::{Cursor, Write},
    path::PathBuf,
};
use tauri::Manager;
use zip::{write::SimpleFileOptions, ZipWriter};

const REL: &str = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT: &str = "http://schemas.openxmlformats.org/package/2006/content-types";
fn xml(s: &str) -> String {
    s.chars()
        .filter(|c| *c == '\n' || *c == '\t' || *c == '\r' || *c >= ' ')
        .collect::<String>()
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
fn string(v: &Value, k: &str, max: usize) -> Result<String, String> {
    let s = v.get(k).and_then(Value::as_str).unwrap_or("");
    if s.chars().count() > max {
        return Err(format!("{k}: texto demasiado largo"));
    }
    Ok(s.to_owned())
}
fn array<'a>(v: &'a Value, k: &str, max: usize) -> Result<&'a Vec<Value>, String> {
    let a = v
        .get(k)
        .and_then(Value::as_array)
        .ok_or(format!("Falta la lista {k}"))?;
    if a.is_empty() || a.len() > max {
        return Err(format!("{k}: entre 1 y {max} elementos"));
    }
    Ok(a)
}
fn add(z: &mut ZipWriter<Cursor<Vec<u8>>>, name: &str, text: String) -> Result<(), String> {
    z.start_file(
        name,
        SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated),
    )
    .map_err(|e| e.to_string())?;
    z.write_all(text.as_bytes()).map_err(|e| e.to_string())
}
fn root_rels(target: &str) -> String {
    format!(
        r#"<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{OFFICE}/officeDocument" Target="{target}"/></Relationships>"#
    )
}
fn types(overrides: &[(&str, &str)]) -> String {
    format!(
        r#"<Types xmlns="{CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>{}</Types>"#,
        overrides
            .iter()
            .map(|(p, t)| format!(r#"<Override PartName="/{p}" ContentType="{t}"/>"#))
            .collect::<String>()
    )
}
fn text_run(text: &str, properties: &str) -> String {
    let body = text
        .split('\n')
        .map(|line| format!(r#"<w:t xml:space="preserve">{}</w:t>"#, xml(line)))
        .collect::<Vec<_>>()
        .join("<w:br/>");
    format!("<w:r><w:rPr>{properties}</w:rPr>{body}</w:r>")
}
/// A small, deterministic inline grammar: preserve Unicode and line breaks.
fn formatted_runs(text: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while !rest.is_empty() {
        let next = [
            ("**", "<w:b/>"),
            (
                "`",
                r#"<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>"#,
            ),
        ]
        .iter()
        .filter_map(|(delimiter, style)| rest.find(delimiter).map(|at| (at, *delimiter, *style)))
        .min_by_key(|row| row.0);
        let Some((at, delimiter, style)) = next else {
            out += &text_run(rest, "");
            break;
        };
        out += &text_run(&rest[..at], "");
        let body = &rest[at + delimiter.len()..];
        if let Some(end) = body.find(delimiter) {
            out += &text_run(&body[..end], style);
            rest = &body[end + delimiter.len()..];
        } else {
            out += &text_run(&rest[at..], "");
            break;
        }
    }
    out
}
fn paragraph(text: &str, style: &str) -> String {
    format!(
        r#"<w:p><w:pPr><w:pStyle w:val="{style}"/><w:widowControl/><w:spacing w:after="140" w:line="280" w:lineRule="auto"/></w:pPr>{}</w:p>"#,
        formatted_runs(text)
    )
}

fn docx(z: &mut ZipWriter<Cursor<Vec<u8>>>, s: &Value) -> Result<(), String> {
    let blocks = array(s, "blocks", 500)?;
    let mut body = paragraph(&string(s, "title", 180)?, "Title");
    for b in blocks {
        let kind = b.get("type").and_then(Value::as_str).unwrap_or("paragraph");
        match kind {
            "heading" => {
                body += &paragraph(
                    &string(b, "text", 2000)?,
                    if b.get("level").and_then(Value::as_u64) == Some(2) {
                        "Heading2"
                    } else {
                        "Heading1"
                    },
                )
            }
            "paragraph" => body += &paragraph(&string(b, "text", 20000)?, "Normal"),
            "bullets" | "numbered" => {
                for item in array(b, "items", 100)? {
                    let text = item.as_str().ok_or("Cada viñeta debe ser texto")?;
                    if text.len() > 10000 {
                        return Err("Viñeta demasiado larga".into());
                    }
                    body += &format!(
                        r#"<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="{}"/></w:numPr><w:spacing w:after="100"/><w:widowControl/></w:pPr>{}</w:p>"#,
                        if kind == "numbered" { 2 } else { 1 },
                        formatted_runs(text)
                    );
                }
            }
            "table" => {
                let rows = array(b, "rows", 150)?;
                let mut table = String::from(
                    r#"<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CED4DC"/><w:left w:val="single" w:sz="4" w:color="CED4DC"/><w:bottom w:val="single" w:sz="4" w:color="CED4DC"/><w:right w:val="single" w:sz="4" w:color="CED4DC"/><w:insideH w:val="single" w:sz="4" w:color="CED4DC"/><w:insideV w:val="single" w:sz="4" w:color="CED4DC"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr>"#,
                );
                let columns = rows
                    .iter()
                    .filter_map(Value::as_array)
                    .map(Vec::len)
                    .max()
                    .unwrap_or(0);
                if columns == 0 || columns > 12 {
                    return Err("Entre 1 y 12 columnas en DOCX".into());
                }
                table += &format!(
                    "<w:tblGrid>{}</w:tblGrid>",
                    (0..columns)
                        .map(|_| format!(r#"<w:gridCol w:w="{}"/>"#, 9638 / columns))
                        .collect::<String>()
                );
                for (i, r) in rows.iter().enumerate() {
                    let cells = r.as_array().ok_or("Fila de tabla no válida")?;
                    if cells.len() > 12 {
                        return Err("Máximo 12 columnas en DOCX".into());
                    }
                    table += if i == 0 {
                        "<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>"
                    } else {
                        "<w:tr><w:trPr><w:cantSplit/></w:trPr>"
                    };
                    for column in 0..columns {
                        let text = match cells.get(column) {
                            Some(cell) => cell.as_str().ok_or("Las celdas DOCX deben ser texto")?,
                            None => "",
                        };
                        if text.len() > 10000 {
                            return Err("Celda demasiado larga".into());
                        }
                        table += &format!(
                            "<w:tc><w:tcPr><w:tcW w:w=\"{}\" w:type=\"dxa\"/>{}</w:tcPr>{}</w:tc>",
                            9638 / columns,
                            if i == 0 {
                                r#"<w:shd w:fill="EDF1F5"/>"#
                            } else {
                                ""
                            },
                            paragraph(text, if i == 0 { "Heading3" } else { "Normal" })
                        );
                    }
                    table += "</w:tr>";
                }
                table += "</w:tbl>";
                body += &table;
            }
            "page_break" => body += r#"<w:p><w:r><w:br w:type="page"/></w:r></w:p>"#,
            _ => return Err("Tipo de bloque DOCX no admitido".into()),
        }
    }
    add(
        z,
        "[Content_Types].xml",
        types(&[
            (
                "word/footer1.xml",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml",
            ),
            (
                "word/document.xml",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
            ),
            (
                "word/styles.xml",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml",
            ),
            (
                "word/numbering.xml",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml",
            ),
        ]),
    )?;
    add(z, "_rels/.rels", root_rels("word/document.xml"))?;
    add(
        z,
        "word/_rels/document.xml.rels",
        format!(
            r#"<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{OFFICE}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="{OFFICE}/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="{OFFICE}/footer" Target="footer1.xml"/></Relationships>"#
        ),
    )?;
    add(z,"word/styles.xml",r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:color w:val="202A36"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:widowControl/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:spacing w:before="280"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:rPr><w:b/></w:rPr></w:style></w:styles>"#.into())?;
    add(z,"word/numbering.xml",r#"<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="180"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>"#.into())?;
    add(z,"word/footer1.xml",r#"<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="68717A"/></w:rPr><w:t>Página </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>"#.into())?;
    add(
        z,
        "word/document.xml",
        format!(
            r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>{body}<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>"#
        ),
    )
}
fn column(mut i: usize) -> String {
    let mut s = String::new();
    loop {
        s.insert(0, (b'A' + (i % 26) as u8) as char);
        if i < 26 {
            break;
        }
        i = i / 26 - 1;
    }
    s
}
fn xlsx(z: &mut ZipWriter<Cursor<Vec<u8>>>, s: &Value) -> Result<(), String> {
    let sheets = array(s, "sheets", 12)?;
    let mut overrides = vec![
        (
            "xl/workbook.xml".to_owned(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml".to_owned(),
        ),
        (
            "xl/styles.xml".into(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml".into(),
        ),
    ];
    let (mut books, mut rels) = (String::new(), String::new());
    let mut names = std::collections::HashSet::new();
    for (i, sh) in sheets.iter().enumerate() {
        let name = string(sh, "name", 31)?;
        if name.trim().is_empty()
            || name.contains(['[', ']', ':', '*', '?', '/', '\\'])
            || !names.insert(name.to_lowercase())
        {
            return Err("Nombres de hojas únicos, de 1 a 31 caracteres, sin []:*?/\\".into());
        }
        let rows = array(sh, "rows", 5000)?;
        let cols = rows
            .iter()
            .filter_map(Value::as_array)
            .map(Vec::len)
            .max()
            .unwrap_or(1);
        if cols > 50 {
            return Err("Máximo 50 columnas".into());
        }
        let mut data = String::new();
        for (r, row) in rows.iter().enumerate() {
            let cells = row.as_array().ok_or("Fila XLSX no válida")?;
            data += &format!("<row r=\"{}\">", r + 1);
            for (c, v) in cells.iter().enumerate() {
                let loc = format!("{}{}", column(c), r + 1);
                let style = if r == 0 { 1 } else { 0 };
                data += &match v {
                    Value::Number(n) => format!(r#"<c r="{loc}" s="{style}"><v>{n}</v></c>"#),
                    Value::Bool(b) => format!(
                        r#"<c r="{loc}" s="{style}" t="b"><v>{}</v></c>"#,
                        if *b { 1 } else { 0 }
                    ),
                    Value::Null => String::new(),
                    Value::String(t) => {
                        if t.len() > 32700 {
                            return Err("Celda XLSX demasiado larga".into());
                        }
                        format!(
                            r#"<c r="{loc}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{}</t></is></c>"#,
                            xml(t)
                        )
                    }
                    _ => {
                        return Err("Cada celda XLSX debe ser texto, número, booleano o null".into())
                    }
                };
            }
            data += "</row>";
        }
        let part = format!("xl/worksheets/sheet{}.xml", i + 1);
        overrides.push((
            part.clone(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml".into(),
        ));
        add(
            z,
            &part,
            format!(
                r#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="{cols}" width="24" customWidth="1"/></cols><sheetData>{data}</sheetData><autoFilter ref="A1:{}{}"/></worksheet>"#,
                column(cols.saturating_sub(1)),
                rows.len()
            ),
        )?;
        books += &format!(
            r#"<sheet name="{}" sheetId="{}" r:id="rId{}"/>"#,
            xml(&name),
            i + 1,
            i + 1
        );
        rels += &format!(
            r#"<Relationship Id="rId{}" Type="{OFFICE}/worksheet" Target="worksheets/sheet{}.xml"/>"#,
            i + 1,
            i + 1
        );
    }
    add(
        z,
        "[Content_Types].xml",
        types(
            &overrides
                .iter()
                .map(|(a, b)| (a.as_str(), b.as_str()))
                .collect::<Vec<_>>(),
        ),
    )?;
    add(z, "_rels/.rels", root_rels("xl/workbook.xml"))?;
    add(
        z,
        "xl/workbook.xml",
        format!(
            r#"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="{OFFICE}"><sheets>{books}</sheets></workbook>"#
        ),
    )?;
    add(
        z,
        "xl/_rels/workbook.xml.rels",
        format!(
            r#"<Relationships xmlns="{REL}">{rels}<Relationship Id="rIdStyles" Type="{OFFICE}/styles" Target="styles.xml"/></Relationships>"#
        ),
    )?;
    add(z,"xl/styles.xml",r#"<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF344658"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>"#.into())
}
fn shape(id: u32, text: &str, x: u32, y: u32, w: u32, h: u32, size: u32, bold: bool) -> String {
    format!(r#"<p:sp><p:nvSpPr><p:cNvPr id="{id}" name="Text {id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{w}" cy="{h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>{}</p:txBody></p:sp>"#,text.lines().map(|line|format!(r#"<a:p><a:pPr><a:spcAft><a:spcPts val="1000"/></a:spcAft></a:pPr><a:r><a:rPr lang="es-ES" sz="{size}" b="{}"><a:solidFill><a:srgbClr val="233247"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>{}</a:t></a:r></a:p>"#,if bold{1}else{0},xml(line))).collect::<String>())
}
const GROUP: &str = r#"<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>"#;
fn pptx(z: &mut ZipWriter<Cursor<Vec<u8>>>, s: &Value) -> Result<(), String> {
    let slides = array(s, "slides", 40)?;
    let (mut ids, mut rels) = (String::new(), String::new());
    let mut overrides = vec![
        (
            "ppt/presentation.xml".into(),
            "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"
                .into(),
        ),
        (
            "ppt/slideMasters/slideMaster1.xml".into(),
            "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml".into(),
        ),
        (
            "ppt/slideLayouts/slideLayout1.xml".into(),
            "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml".into(),
        ),
    ];
    for (i, sl) in slides.iter().enumerate() {
        let title = string(sl, "title", 160)?;
        let body = string(sl, "body", 1600)?;
        let title_shape = shape(2, &title, 670000, 500000, 10800000, 1400000, 3000, true);
        let body_shape = shape(3, &body, 670000, 2000000, 10800000, 4000000, 2000, false);
        let part = format!("ppt/slides/slide{}.xml", i + 1);
        overrides.push((
            part.clone(),
            "application/vnd.openxmlformats-officedocument.presentationml.slide+xml".into(),
        ));
        add(
            z,
            &part,
            format!(
                r#"<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{OFFICE}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F7F8FA"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>{GROUP}{title_shape}{body_shape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>"#
            ),
        )?;
        add(
            z,
            &format!("ppt/slides/_rels/slide{}.xml.rels", i + 1),
            format!(
                r#"<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{OFFICE}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>"#
            ),
        )?;
        ids += &format!(r#"<p:sldId id="{}" r:id="rId{}"/>"#, 256 + i, i + 1);
        rels += &format!(
            r#"<Relationship Id="rId{}" Type="{OFFICE}/slide" Target="slides/slide{}.xml"/>"#,
            i + 1,
            i + 1
        );
    }
    add(
        z,
        "[Content_Types].xml",
        types(
            &overrides
                .iter()
                .map(|(a, b): &(String, String)| (a.as_str(), b.as_str()))
                .collect::<Vec<_>>(),
        ),
    )?;
    add(z, "_rels/.rels", root_rels("ppt/presentation.xml"))?;
    add(
        z,
        "ppt/presentation.xml",
        format!(
            r#"<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{OFFICE}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:sldIdLst>{ids}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>"#
        ),
    )?;
    add(
        z,
        "ppt/_rels/presentation.xml.rels",
        format!(
            r#"<Relationships xmlns="{REL}">{rels}<Relationship Id="rIdMaster" Type="{OFFICE}/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>"#
        ),
    )?;
    add(
        z,
        "ppt/slideMasters/slideMaster1.xml",
        format!(
            r#"<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{OFFICE}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>{GROUP}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>"#
        ),
    )?;
    add(
        z,
        "ppt/slideMasters/_rels/slideMaster1.xml.rels",
        format!(
            r#"<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{OFFICE}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>"#
        ),
    )?;
    add(
        z,
        "ppt/slideLayouts/slideLayout1.xml",
        format!(
            r#"<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="{OFFICE}" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree>{GROUP}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>"#
        ),
    )?;
    add(
        z,
        "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
        format!(
            r#"<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{OFFICE}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>"#
        ),
    )
}
fn figure(spec: &Value) -> Result<Vec<u8>, String> {
    fn number(v: &Value, key: &str, fallback: f64, max: f64) -> Result<f64, String> {
        let n = v.get(key).and_then(Value::as_f64).unwrap_or(fallback);
        if !n.is_finite() || n < 0.0 || n > max {
            return Err(format!("{key}: valor no válido"));
        }
        Ok(n)
    }
    fn color(v: &Value, key: &str, fallback: &str) -> Result<String, String> {
        let s = v.get(key).and_then(Value::as_str).unwrap_or(fallback);
        if s == "none"
            || (s.starts_with('#')
                && [4, 7, 9].contains(&s.len())
                && s[1..].chars().all(|c| c.is_ascii_hexdigit()))
        {
            Ok(s.to_string())
        } else {
            Err("Color no válido; usa hexadecimal".into())
        }
    }
    let width = number(spec, "width", 960.0, 2400.0)?;
    let height = number(spec, "height", 600.0, 2400.0)?;
    if width < 160.0 || height < 120.0 {
        return Err("Lienzo demasiado pequeño".into());
    }
    let mut content = format!(
        r#"<title>{}</title><rect width="100%" height="100%" fill="{}"/>"#,
        xml(&string(spec, "title", 180)?),
        color(spec, "background", "#ffffff")?
    );
    for shape in array(spec, "elements", 400)? {
        let kind = shape.get("type").and_then(Value::as_str).unwrap_or("");
        let fill = color(shape, "fill", "none")?;
        let stroke = color(shape, "stroke", "#233247")?;
        let sw = number(shape, "strokeWidth", 2.0, 20.0)?;
        let x = number(shape, "x", 0.0, width)?;
        let y = number(shape, "y", 0.0, height)?;
        let attrs = format!(r#"fill="{fill}" stroke="{stroke}" stroke-width="{sw}""#);
        content += &match kind {
            "rect" => format!(
                r#"<rect x="{x}" y="{y}" width="{}" height="{}" rx="{}" {attrs}/>"#,
                number(shape, "width", 100.0, width)?,
                number(shape, "height", 60.0, height)?,
                number(shape, "radius", 0.0, 100.0)?
            ),
            "circle" => format!(
                r#"<circle cx="{x}" cy="{y}" r="{}" {attrs}/>"#,
                number(shape, "radius", 30.0, width.max(height))?
            ),
            "line" => format!(
                r#"<line x1="{x}" y1="{y}" x2="{}" y2="{}" {attrs}/>"#,
                number(shape, "x2", 0.0, width)?,
                number(shape, "y2", 0.0, height)?
            ),
            "text" => format!(
                r#"<text x="{x}" y="{y}" fill="{}" font-family="Arial,sans-serif" font-size="{}">{}</text>"#,
                color(shape, "fill", "#233247")?,
                number(shape, "fontSize", 20.0, 120.0)?,
                xml(&string(shape, "text", 1000)?)
            ),
            _ => return Err("Figura no admitida; usa rect, circle, line o text".into()),
        };
    }
    Ok(format!(r#"<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">{content}</svg>"#).into_bytes())
}
pub fn generate(format: &str, spec: &Value) -> Result<Vec<u8>, String> {
    if serde_json::to_vec(spec).map_err(|e| e.to_string())?.len() > 2_000_000 {
        return Err("El documento supera 2 MB de contenido".into());
    }
    if format == "svg" {
        return figure(spec);
    }
    let mut z = ZipWriter::new(Cursor::new(Vec::new()));
    match format {
        "docx" => docx(&mut z, spec)?,
        "xlsx" => xlsx(&mut z, spec)?,
        "pptx" => pptx(&mut z, spec)?,
        _ => return Err("Formato no admitido".into()),
    }
    Ok(z.finish().map_err(|e| e.to_string())?.into_inner())
}
fn folder(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    let parsed = uuid::Uuid::parse_str(id).map_err(|_| "ID de archivo no válido")?;
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("charvis-artifacts")
        .join(parsed.to_string()))
}
#[tauri::command]
pub async fn charvis_create_artifact(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    format: String,
    spec: Value,
) -> Result<Value, String> {
    if window.label() != "main" {
        return Err("Ventana no permitida".into());
    }
    static SLOTS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(1);
    let _slot = SLOTS
        .try_acquire()
        .map_err(|_| "Hay un documento en preparación")?;
    tauri::async_runtime::spawn_blocking(move||{let bytes=generate(&format,&spec)?;let id=uuid::Uuid::new_v4().to_string();let path=folder(&app,&id)?;fs::create_dir_all(&path).map_err(|e|e.to_string())?;let title=string(&spec,"title",180)?;let safe:String=title.chars().map(|c|if c.is_alphanumeric()||c==' '||c=='-'||c=='_'{c}else{'_'}).take(80).collect();let filename=format!("{}.{}",if safe.trim().is_empty(){"Documento"}else{safe.trim()},format);let metadata=json!({"id":id,"filename":filename,"title":title,"format":format,"bytes":bytes.len(),"spec":spec});fs::write(path.join("payload.dpapi"),crate::charvis_vault::seal(&bytes)?).map_err(|e|e.to_string())?;fs::write(path.join("metadata.dpapi"),crate::charvis_vault::seal(&serde_json::to_vec(&metadata).map_err(|e|e.to_string())?)?).map_err(|e|e.to_string())?;Ok(metadata)}).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn charvis_artifact_bytes(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    id: String,
) -> Result<Vec<u8>, String> {
    if window.label() != "main" {
        return Err("Ventana no permitida".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let path = folder(&app, &id)?;
        if path.join("payload.dpapi").exists() {
            return crate::charvis_vault::open(
                &fs::read(path.join("payload.dpapi")).map_err(|e| e.to_string())?,
            );
        }
        let meta: Value = serde_json::from_slice(
            &fs::read(path.join("metadata.json")).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        let filename = meta["filename"].as_str().ok_or("Archivo no válido")?;
        if filename.contains(['/', '\\']) {
            return Err("Nombre no válido".into());
        }
        let original = path.join(filename);
        let bytes = fs::read(&original).map_err(|e| e.to_string())?;
        fs::write(
            path.join("payload.dpapi"),
            crate::charvis_vault::seal(&bytes)?,
        )
        .map_err(|e| e.to_string())?;
        fs::write(
            path.join("metadata.dpapi"),
            crate::charvis_vault::seal(&serde_json::to_vec(&meta).map_err(|e| e.to_string())?)?,
        )
        .map_err(|e| e.to_string())?;
        fs::remove_file(original).map_err(|e| e.to_string())?;
        fs::remove_file(path.join("metadata.json")).map_err(|e| e.to_string())?;
        Ok(bytes)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn documents_are_real_office_packages() {
        for (format, spec, part) in [
            (
                "docx",
                json!({"title":"Física","blocks":[{"type":"heading","text":"Energía"},{"type":"paragraph","text":"p < 0.05 & ΔE"},{"type":"bullets","items":["masa","velocidad"]},{"type":"table","rows":[["Valor","Unidad"],["2","J"]]}]}),
                "word/document.xml",
            ),
            (
                "xlsx",
                json!({"title":"Datos","sheets":[{"name":"Mediciones","rows":[["t","x"],[1,2.5],[2,5]]}]}),
                "xl/workbook.xml",
            ),
            (
                "pptx",
                json!({"title":"Repaso","slides":[{"title":"Energía","body":"Masa\nVelocidad"}]}),
                "ppt/presentation.xml",
            ),
        ] {
            let bytes = generate(format, &spec).unwrap();
            let folder = std::path::Path::new("target/qa-artifacts");
            std::fs::create_dir_all(folder).unwrap();
            std::fs::write(folder.join(format!("verificado.{format}")), &bytes).unwrap();
            assert!(bytes.starts_with(b"PK"));
            let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
            assert!(archive.by_name(part).is_ok());
            assert!(archive.by_name("[Content_Types].xml").is_ok());
        }
    }
    #[test]
    fn figures_are_bounded_static_svg() {
        let value = json!({"title":"Movimiento <seguro>","width":800,"height":500,"elements":[{"type":"rect","x":10,"y":20,"width":100,"height":80,"fill":"#dfeaff"},{"type":"text","x":30,"y":60,"text":"<script>alert(1)</script> Δx"}]});
        let svg = String::from_utf8(generate("svg", &value).unwrap()).unwrap();
        assert!(svg.starts_with("<svg"));
        assert!(svg.contains("&lt;script&gt;"));
        assert!(!svg.contains("<script>"));
        assert!(generate("svg", &json!({"title":"No","elements":[{"type":"script"}]})).is_err());
        assert!(generate(
            "svg",
            &json!({"title":"No","elements":[{"type":"rect","fill":"url(https://evil.test/x)"}]})
        )
        .is_err());
        assert!(generate(
            "svg",
            &json!({"title":"No","width":999999,"elements":[{"type":"line"}]})
        )
        .is_err());
    }
    #[test]
    fn docx_preserves_formatting_and_layout() {
        use std::io::Read;
        let spec = json!({"title":"Informe de Física","blocks":[{"type":"heading","text":"Energía y medición"},{"type":"paragraph","text":"**Energía cinética** y `E = ½mv²`\nUnidades: J = kg·m²·s⁻²; α, Δx."},{"type":"numbered","items":["Medir la masa","Registrar la velocidad"]},{"type":"table","rows":[["Magnitud","Unidad"],["Energía","J"],["Masa"]]}]});
        let bytes = generate("docx", &spec).unwrap();
        let folder = std::path::Path::new("target/qa-artifacts");
        std::fs::create_dir_all(folder).unwrap();
        std::fs::write(folder.join("formato.docx"), &bytes).unwrap();
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        archive
            .by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(
            document.contains("<w:b/>")
                && document.contains("<w:br/>")
                && document.contains("<w:tblHeader/>")
                && document.contains("w:numId w:val=\"2\"")
        );
        assert!(
            document.contains("½mv²")
                && !document.contains("**Energía")
                && !document.contains("`E =")
        );
        assert!(
            document.contains("w:footerReference") && archive.by_name("word/footer1.xml").is_ok()
        );
    }
    #[test]
    fn rejects_invalid_sheet_names() {
        assert!(generate("xlsx", &json!({"sheets":[{"name":"../bad","rows":[[1]]}]})).is_err());
    }
}

"""Build explicitly fictional, paginated PDFs from the reusable sample corpus."""
import json
from pathlib import Path
from reportlab.lib import colors
from reportlab import rl_config
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from xml.sax.saxutils import escape
root = Path(__file__).resolve().parents[2]
rl_config.invariant = 1
out = root / 'output/pdf'
out.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='Caption', fontName='Helvetica', fontSize=9, textColor=colors.HexColor('#555555')))
styles.add(ParagraphStyle(name='ManualBody', fontName='Helvetica', fontSize=11, leading=17, spaceAfter=16))
styles.add(ParagraphStyle(name='ManualTitle', fontName='Helvetica-Bold', fontSize=22, leading=27, textColor=colors.HexColor('#1f45a0'), spaceAfter=20))
styles.add(ParagraphStyle(name='ManualSection', fontName='Helvetica-Bold', fontSize=15, leading=20, spaceAfter=20))
for manual in json.loads((root / 'tools/dev/manuals.json').read_text()):
    # Generated files are immutable fixture assets once seeded/cited. A changed
    # manual needs a new key/revision; setup must not regenerate its metadata.
    if (out / (manual['key'] + '.pdf')).exists():
        continue
    story = []
    for index, page in enumerate(manual['pages']):
        if index: story.append(PageBreak())
        story += [Paragraph(escape(manual['title']), styles['ManualTitle']),
                  Paragraph('REV A | FICTIONAL TRAINING REFERENCE', styles['Caption']), Spacer(1, 24),
                  Paragraph(escape(page['heading']), styles['ManualSection'])]
        story += [Paragraph(escape(p), styles['ManualBody']) for p in page['paragraphs']]
    def footer(canvas, doc):
        canvas.setStrokeColor(colors.HexColor('#ccd1d9'))
        canvas.line(48, 48, 547, 48)
        canvas.setFont('Helvetica', 9)
        canvas.drawString(48, 33, 'ArgonIQ software examples | Not for operating real equipment')
        canvas.drawRightString(547, 33, str(doc.page))
    SimpleDocTemplate(str(out / (manual['key'] + '.pdf')), pagesize=(595, 842),
        rightMargin=48, leftMargin=48, topMargin=48, bottomMargin=68,
        title=manual['title'], author='ArgonIQ - fictional software fixtures').build(story, onFirstPage=footer, onLaterPages=footer)
print('Built 4 fictional PDFs in output/pdf.')

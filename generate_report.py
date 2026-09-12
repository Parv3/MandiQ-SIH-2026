import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

pdf_path = r"c:\Users\Parv Mishra\Desktop\COLLEGE\CampusNow\MandiQ\MandiQ_Farmer_Demographics_Report.pdf"

doc = SimpleDocTemplate(
    pdf_path,
    pagesize=letter,
    rightMargin=40,
    leftMargin=40,
    topMargin=40,
    bottomMargin=40
)

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'DocTitle',
    parent=styles['Heading1'],
    fontSize=22,
    leading=26,
    textColor=colors.HexColor("#1b4d3e"),
    spaceAfter=6
)

subtitle_style = ParagraphStyle(
    'DocSubtitle',
    parent=styles['Normal'],
    fontSize=11,
    leading=14,
    textColor=colors.HexColor("#555555"),
    spaceAfter=15
)

h2_style = ParagraphStyle(
    'SectionHeader',
    parent=styles['Heading2'],
    fontSize=13,
    leading=17,
    textColor=colors.HexColor("#1b4d3e"),
    spaceBefore=12,
    spaceAfter=8
)

body_style = ParagraphStyle(
    'BodyTextCustom',
    parent=styles['Normal'],
    fontSize=9.5,
    leading=13.5,
    textColor=colors.HexColor("#222222"),
    spaceAfter=6
)

table_header_style = ParagraphStyle(
    'TableHeader',
    parent=styles['Normal'],
    fontSize=9,
    leading=11,
    textColor=colors.white,
    fontName='Helvetica-Bold'
)

table_cell_style = ParagraphStyle(
    'TableCell',
    parent=styles['Normal'],
    fontSize=8.5,
    leading=11,
    textColor=colors.HexColor("#222222")
)

callout_style = ParagraphStyle(
    'CalloutText',
    parent=styles['Normal'],
    fontSize=9.5,
    leading=14,
    textColor=colors.HexColor("#0f392b"),
    fontName='Helvetica-Bold'
)

elements = []

elements.append(Paragraph("MandiQ: Farmer Demographics & Technology Accessibility", title_style))
elements.append(Paragraph("A Data-Backed Analysis on Farmer Literacy, Smartphone Adoption, and the Critical Role of IVR Voice Solutions in Agricultural Procurement | India", subtitle_style))
elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1b4d3e"), spaceAfter=12))

elements.append(Paragraph("1. Literacy Profile Among Farmers & Rural Households", h2_style))
elements.append(Paragraph("While aggregate literacy statistics show modest growth, functional literacy required to decipher digital contracts, mandi pricing boards, and smartphone app workflows remains exceptionally low.", body_style))

data_lit = [
    [Paragraph("Metric / Indicator", table_header_style), Paragraph("National Figure", table_header_style), Paragraph("Official Source", table_header_style)],
    [Paragraph("Overall Rural Literacy Rate", table_cell_style), Paragraph("<b>67.8%</b>", table_cell_style), Paragraph("Census of India (MoHA)", table_cell_style)],
    [Paragraph("Rural Male vs Female Literacy", table_cell_style), Paragraph("<b>77.2%</b> (M) / <b>57.9%</b> (F)", table_cell_style), Paragraph("Census of India (MoHA)", table_cell_style)],
    [Paragraph("Agricultural Households w/ Illiterate Head", table_cell_style), Paragraph("<b>~25% (~23-25 Million families)</b>", table_cell_style), Paragraph("NSS 77th Round (MOSPI)", table_cell_style)],
    [Paragraph("Total Farming Households in India", table_cell_style), Paragraph("<b>~93 Million</b>", table_cell_style), Paragraph("NSS 77th Round (MOSPI)", table_cell_style)],
    [Paragraph("Functionally Illiterate (Cannot verify contracts/notices)", table_cell_style), Paragraph("<b>40% - 50%</b> (estimated)", table_cell_style), Paragraph("NABARD NAFIS Report", table_cell_style)],
]

t1 = Table(data_lit, colWidths=[200, 150, 180])
t1.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1b4d3e")),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#f8faf9"), colors.white]),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dcdcdc")),
]))
elements.append(t1)
elements.append(Spacer(1, 10))

elements.append(Paragraph("2. Smartphone & Digital Penetration in Agriculture", h2_style))
data_tech = [
    [Paragraph("Digital Technology Indicator", table_header_style), Paragraph("Coverage / Adoption", table_header_style), Paragraph("Authoritative Source", table_header_style)],
    [Paragraph("Total Rural Internet Users", table_cell_style), Paragraph("<b>~353 Million</b>", table_cell_style), Paragraph("TRAI Annual Report / IAMAI", table_cell_style)],
    [Paragraph("Rural Internet Penetration", table_cell_style), Paragraph("<b>~37%</b> of rural population", table_cell_style), Paragraph("IAMAI Internet in India", table_cell_style)],
    [Paragraph("Rural Households Owning a Smartphone", table_cell_style), Paragraph("<b>~25%</b>", table_cell_style), Paragraph("NFHS-5 (MoHFW)", table_cell_style)],
    [Paragraph("Farmers Actively Using Apps for Agriculture", table_cell_style), Paragraph("<b>15% - 20%</b>", table_cell_style), Paragraph("GSMA Connected Society", table_cell_style)],
    [Paragraph("Farmers Relying on Basic Feature Phones", table_cell_style), Paragraph("<b>55% - 60%</b>", table_cell_style), Paragraph("NSSO / NABARD Surveys", table_cell_style)],
    [Paragraph("Farmers with Zero Mobile Phone Access", table_cell_style), Paragraph("<b>20% - 25%</b>", table_cell_style), Paragraph("NABARD Finscope", table_cell_style)],
]

t2 = Table(data_tech, colWidths=[200, 150, 180])
t2.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1b4d3e")),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#f8faf9"), colors.white]),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dcdcdc")),
]))
elements.append(t2)
elements.append(Spacer(1, 10))

elements.append(Paragraph("3. Accessibility Comparison Across Delivery Channels", h2_style))
data_chan = [
    [Paragraph("Channel / Interface", table_header_style), Paragraph("Reachable Farmers", table_header_style), Paragraph("Key Constraints & Exploitation Risks", table_header_style)],
    [Paragraph("Smartphone App", table_cell_style), Paragraph("<b>15% - 20%</b>", table_cell_style), Paragraph("High device cost, literacy barriers, app store friction.", table_cell_style)],
    [Paragraph("SMS Alerts (Text)", table_cell_style), Paragraph("<b>35% - 40%</b>", table_cell_style), Paragraph("Requires script literacy; ignored or read by middlemen.", table_cell_style)],
    [Paragraph("<b>Interactive Voice Response (IVR)</b>", table_cell_style), Paragraph("<b>75% - 80%</b>", table_cell_style), Paragraph("<b>Zero literacy required; dial-in audio in local dialects.</b>", table_cell_style)],
    [Paragraph("Physical Center Kiosk", table_cell_style), Paragraph("~100%", table_cell_style), Paragraph("Middlemen manipulate queues, demand bribes, reassign tokens.", table_cell_style)],
]

t3 = Table(data_chan, colWidths=[160, 130, 240])
t3.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1b4d3e")),
    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.HexColor("#f8faf9"), colors.white]),
    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dcdcdc")),
]))
elements.append(t3)
elements.append(Spacer(1, 12))

callout_data = [[
    Paragraph("Executive Summary & Strategic Rationale for MandiQ:<br/><font color='#222222'>Out of ~93 million agrarian households across India, over 23 to 25 million heads of household cannot read or write. Furthermore, fewer than 1 in 5 farmers can operate mobile apps for agricultural trade. By deploying an automated telephony IVR system paired with real-time transparent queue allocation, MandiQ democratizes access for up to 80% of farming families, eliminating middlemen exploitation and procurement center corruption at the point of booking.</font>", callout_style)
]]
t_callout = Table(callout_data, colWidths=[530])
t_callout.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#eef7f2")),
    ('BOX', (0,0), (-1,-1), 1.2, colors.HexColor("#1b4d3e")),
    ('TOPPADDING', (0,0), (-1,-1), 8),
    ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ('LEFTPADDING', (0,0), (-1,-1), 10),
    ('RIGHTPADDING', (0,0), (-1,-1), 10),
]))
elements.append(t_callout)

doc.build(elements)
print("PDF generated successfully at:", pdf_path)

"""Build the measurement-conditional left-bay garage door manual.

Run with Python + reportlab. All drawing dimensions are schematic.
No final door dimensions are inferred from the existing door measurement.
"""
from pathlib import Path
import math
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont('Manual','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Manual-Bold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFontFamily('Manual',normal='Manual',bold='Manual-Bold',italic='Manual',boldItalic='Manual-Bold')

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/garage/Left_Bay_Door_Build_Manual.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
W, H = 595.28, 841.89
M = 38
INK = HexColor('#18343d'); TEAL = HexColor('#19766f')
PALE = HexColor('#eaf2ef'); TAN = HexColor('#dfc5a0')
GRAY = HexColor('#65777c'); LINE = HexColor('#ccd6d5')
AMBER = HexColor('#965012'); LIGHT = HexColor('#faf2e5')
BLUE = HexColor('#7595a3')
c = canvas.Canvas(str(OUT), pagesize=(W,H))
c.setTitle('Left Bay Door Build Manual - Measurement-Conditional Draft')
c.setAuthor('Rafael Renó | Garage project')
c.setSubject('Two new outward-swinging timber doors. Planning issue, not released for cutting or hanging.')
PAGES=[]

def p(txt,x,y,width=519,size=11,color=INK,leading=None,bold=False):
    st=ParagraphStyle('x',fontName='Manual-Bold' if bold else 'Manual',fontSize=size,
                      leading=leading or size*1.38,textColor=color,spaceAfter=0)
    ob=Paragraph(txt,st); _,hh=ob.wrap(width,1000); ob.drawOn(c,x,y-hh)
    if y-hh<42: raise ValueError(f'Text overflow: {txt[:60]}')
    return y-hh

def text(txt,x,y,size=10,color=INK):
    if x+pdfmetrics.stringWidth(txt,'Manual',size)>W-20:raise ValueError('Drawing label overflow: '+txt)
    c.setFillColor(color); c.setFont('Manual',size); c.drawString(x,y,txt)

def line(x1,y1,x2,y2,color=INK,width=1):
    c.setStrokeColor(color); c.setLineWidth(width); c.line(x1,y1,x2,y2)

def rect(x,y,w,h,fill=white,stroke=INK,r=0):
    c.setFillColor(fill);c.setStrokeColor(stroke);c.setLineWidth(1)
    if r:c.roundRect(x,y,w,h,r,fill=1,stroke=1)
    else:c.rect(x,y,w,h,fill=1,stroke=1)

def arrow(x1,y1,x2,y2,color=TEAL,sw=1.5):
    line(x1,y1,x2,y2,color,sw); a=math.atan2(y2-y1,x2-x1);d=7
    for off in (-.45,.45):line(x2,y2,x2-d*math.cos(a+off),y2-d*math.sin(a+off),color,sw)

def badge(label,x,y,color=TEAL):
    c.setFillColor(color);c.circle(x,y,11,fill=1,stroke=0)
    c.setFillColor(white);c.setFont('Manual-Bold',9);c.drawCentredString(x,y-3,label)

def dim(x1,y1,x2,y2,label):
    arrow(x1,y1,x2,y2,GRAY,1);arrow(x2,y2,x1,y1,GRAY,1)
    if abs(y2-y1)<1:text(label,(x1+x2)/2-25,y1+8,9,GRAY)
    else:text(label,x1+7,(y1+y2)/2,9,GRAY)

def note(title,body,y,kind='info',height=66):
    fill=LIGHT if kind=='hold' else PALE
    rect(M,y-height,W-2*M,height,fill,fill,6)
    p(title,M+12,y-10,W-2*M-24,10,AMBER if kind=='hold' else TEAL,bold=True)
    p(body,M+12,y-28,W-2*M-24,10)
    return y-height-16

def start(title,sub,kicker='LEFT BAY / NEW DOORS'):
    PAGES.append(title);c.bookmarkPage(f'page{len(PAGES)}')
    c.addOutlineEntry(title,f'page{len(PAGES)}',0,False)
    rect(0,H-8,W,8,TEAL,TEAL)
    text(kicker,M,H-34,9,TEAL)
    fs=min(25,25*(W-2*M)/max(1,pdfmetrics.stringWidth(title,'Manual-Bold',25)))
    p(title,M,H-49,W-2*M,fs,bold=True,leading=29)
    p(sub,M,H-87,W-2*M,10,GRAY)

def end():
    line(M,36,W-M,36,LINE)
    text('DRAFT 01  |  12 SEP 2026  |  VERIFY BEFORE CUTTING / HANGING',M,23,7,GRAY)
    text(str(len(PAGES)).zfill(2),W-M-12,23,9,TEAL)
    c.showPage()

def table(headers,rows,y,widths,size=9):
    st=ParagraphStyle('cell',fontName='Manual',fontSize=size,leading=size*1.3,textColor=INK)
    data=[[Paragraph(str(v),st) for v in row] for row in [headers]+rows]
    ob=Table(data,colWidths=widths,hAlign='LEFT')
    ob.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),
       ('BOTTOMPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),9),
       ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),
       ('LINEBELOW',(0,0),(-1,-1),.5,LINE)]))
    _,hh=ob.wrap(W-2*M,1000)
    if y-hh<45:raise ValueError(f'Table overflow page {len(PAGES)}: {y-hh}')
    ob.drawOn(c,M,y-hh);return y-hh-14

def steps(items,y):
    for i,body in enumerate(items,1):
        badge(str(i),M+11,y-10)
        yy=p(body,M+31,y,W-2*M-31,11)
        y=min(y-36,yy-15)
    return y

def beam(x1,y1,x2,y2,th=12,color=TAN):
    dx=x2-x1;dy=y2-y1;n=math.hypot(dx,dy);nx=-dy/n*th/2;ny=dx/n*th/2
    pa=c.beginPath();pa.moveTo(x1+nx,y1+ny)
    for xx,yy in [(x2+nx,y2+ny),(x2-nx,y2-ny),(x1-nx,y1-ny)]:pa.lineTo(xx,yy)
    pa.close();c.setFillColor(color);c.setStrokeColor(INK);c.drawPath(pa,stroke=1,fill=1)

def strip_points(x1,y1,x2,y2,th):
    ln=math.hypot(x2-x1,y2-y1);nx=-(y2-y1)/ln*th/2;ny=(x2-x1)/ln*th/2
    return [(x1+nx,y1+ny),(x2+nx,y2+ny),(x2-nx,y2-ny),(x1-nx,y1-ny)]

def clipped(poly,nx,ny,k):
    """Keep the polygon on nx*x + ny*y >= k."""
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=nx*a[0]+ny*a[1]-k;db=nx*b[0]+ny*b[1]-k
        if da>=0:out.append(a)
        if (da>=0)!=(db>=0):
            f=da/(da-db);out.append((a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])))
    return out

def bounded(poly,box):
    x0,y0,x1,y1=box
    for nx,ny,k in [(1,0,x0),(-1,0,-x1),(0,1,y0),(0,-1,-y1)]:poly=clipped(poly,nx,ny,k)
    return poly

def polygon(poly,color=TAN):
    if not poly:return
    pa=c.beginPath();pa.moveTo(*poly[0])
    for point in poly[1:]:pa.lineTo(*point)
    pa.close();c.setFillColor(color);c.setStrokeColor(INK);c.drawPath(pa,stroke=1,fill=1)

def door(x,y,w=150,h=248,mode='frame',mirror=False,brace=True,hinges=False,trim=False):
    t=w*.07
    if mode in ('solid','trim','finish','insulate','lining'):
        rect(x,y,w,h,white if mode in ('finish','lining') else HexColor('#e7d5b9'))
        line(x,y+h/2,x+w,y+h/2,GRAY)
    if mode=='insulate':
        for yy in (y+t,y+h/2+t/2):
            rect(x+t,yy,w-2*t,h/2-1.5*t,HexColor('#b6c09d'),LINE)
    if mode in ('frame','insulate'):
        for xx in (x,x+w-t):rect(xx,y,t,h,TAN)
        for yy in (y,y+h/2-t/2,y+h-t):rect(x,yy,w,t,TAN)
        if brace:
            a=x+w-t if mirror else x+t;b=x+t if mirror else x+w-t
            polygon(bounded(strip_points(a,y+t,b,y+h/2-t/2,t*.85),(x+t,y+t,x+w-t,y+h/2-t/2)))
            polygon(bounded(strip_points(a,y+h/2+t/2,b,y+h-t,t*.85),(x+t,y+h/2+t/2,x+w-t,y+h-t)))
    if trim or mode in ('trim','finish'):
        for xx in (x,x+w-t):rect(xx,y,t,h,white)
        for yy in (y,y+h/2-t/2,y+h-t):rect(x+t,yy,w-2*t,t,white)
        box=(x+t,y+t,x+w-t,y+h/2-t/2);th=t*.7
        ax,ay=x+t,y+t;bx,by=x+w-t,y+h/2-t/2
        polygon(bounded(strip_points(ax,ay,bx,by,th),box),white)
        other=bounded(strip_points(ax,by,bx,ay,th),box)
        ln=math.hypot(bx-ax,by-ay);nx=-(by-ay)/ln;ny=(bx-ax)/ln;k=nx*ax+ny*ay
        # Exact butt intersections at the continuous diagonal, in one plane.
        polygon(clipped(other,nx,ny,k+th/2),white)
        polygon(clipped(other,-nx,-ny,-k+th/2),white)
    if hinges:
        for yy in (y+t*.6,y+h/2,y+h-t*.6):
            xx=x+w-w*.48 if mirror else x
            rect(xx,yy-3,w*.48,6,INK)
            for dd in (.1,.36):c.setFillColor(white);c.circle(xx+w*dd,yy,1.5,fill=1,stroke=0)

def imagebox():
    rect(M,408,W-2*M,294,HexColor('#f5f7f5'),HexColor('#f5f7f5'),8)
    text('SCHEMATIC - NOT TO SCALE',M+12,420,7,GRAY)

def product(name,url):return f'<link href="{url}" color="#19766f"><u>{name}</u></link>'

URL={
'wood':'https://www.homedepot.com/p/2-in-x-4-in-x-96-in-Prime-Kiln-Dried-Douglas-Fir-Stud-785326/202046915',
'outer':'https://www.homedepot.com/p/Plytanium-15-32-in-x-4-ft-x-8-ft-BC-Sanded-Pine-Plywood-201429/100012720',
'inner':'https://www.homedepot.com/p/Plytanium-1-4-in-x-4-ft-x-8-ft-BC-Sanded-Pine-Plywood-235552/100063669',
'trim':'https://www.homedepot.com/p/1-in-x-4-in-x-8-ft-Premium-Pine-S4S-Common-Board-5-Pack-148GS4S5PK/326202743',
'wool':'https://www.homedepot.com/p/ROCKWOOL-R-6-3-Comfortboard-80-1-1-2-in-x-24-in-x-48-in-Stone-Wool-Insulated-Sheathing-Board-48-sqft-RXCB11224/206789748',
'glue':'https://www.homedepot.com/p/Titebond-III-16-oz-Ultimate-Wood-Glue-1414/100522343',
'screw':'https://www.homedepot.com/p/DECKMATE-8-1-1-4-in-Tan-Exterior-Self-Starting-Star-Flat-Head-Wood-Deck-Screws-1-lb-184-Pieces-114DMT1/305418474',
'trimsc':'https://www.homedepot.com/p/306587154',
'primer':'https://www.homedepot.com/p/Zinsser-Cover-Stain-1-gal-White-Oil-Based-Interior-Exterior-Primer-and-Sealer-3501/100398377',
'paint':'https://www.homedepot.com/p/BEHR-PREMIUM-PLUS-1-gal-Ultra-Pure-White-Semi-Gloss-Enamel-Exterior-Paint-Primer-505001/100154684',
'sealant':'https://www.homedepot.com/p/DAP-Dynaflex-230-10-1-oz-White-Premium-Elastomeric-Exterior-Interior-Window-Door-and-Trim-Sealant-18275/100035980',
'perimeter':'https://www.homedepot.com/p/Frost-King-9-ft-x-2-75-in-Dual-Vinyl-Garage-Door-Top-and-Side-Seal-White-GR9/100185922',
'gasket':'https://www.homedepot.com/p/Frost-King-3-4-in-x-7-16-in-x-10-ft-Black-High-Density-Rubber-Foam-Weatherstrip-Tape-R734H/100047977',
'bolt':'https://www.homedepot.com/p/Everbilt-18-in-Black-Cane-Bolt-20076/320092604',
'latch':'https://www.homedepot.com/p/Everbilt-Black-Deluxe-Latch-Gate-Set-18117/202042256',
'pull':'https://www.homedepot.com/p/Everbilt-6-1-2-in-Black-Heavy-Duty-Door-Pull-24365/327599899',
'hinge':'https://www.homedepot.com/p/National-Hardware-24-in-Zinc-Plated-Gate-Hinge-Strap-N248-047/203359515',
'pro':'https://www.homedepot.com/c/pro',
}

materials=[
('A','wood','KD Douglas fir 2x4x8 ft',16,8,8,'A','14 frame / brace boards + 2 for blocking / spare.'),
('B','outer','15/32 in. BC plywood, 4x8 ft',4,42.37,42.37,'P','Exterior stamp required; two half-panels per leaf.'),
('C','inner','1/4 in. BC plywood, 4x8 ft',4,31.5,31.5,'P','Interior removable lining; verify Exterior classification.'),
('D','trim','1x4x8 ft pine, 5-pack',4,54.83,54.83,'P','20 boards: face trim, lower X, stops, astragal, spare.'),
('E','wool','1-1/2 in. Comfortboard 80',1,90,120,'A','48 sq ft pack; confirm availability and cut nesting.'),
('F','glue','Titebond III, 16 oz',2,9.98,9.98,'P','Candidate only: exterior-door glue approval required.'),
('G','screw','#8 x1-1/4 in. exterior screws, 1 lb',3,10.97,10.97,'P','Skins / lap retention; not hinges or wind anchors.'),
('H','trimsc','#8 x2 in. exterior screws, 1 lb',1,10.97,10.97,'P','About 20 mm frame engagement; verify actual layers.'),
('J','primer','Exterior primer, 1 gal',1,40.98,40.98,'P','All faces and cut edges; exclude glue mating faces.'),
('K','paint','Exterior white semi-gloss, 1 gal',1,51.98,51.98,'P','Two coats; verify label coverage and curing time.'),
('L','sealant','Paintable exterior sealant, 10.1 oz',2,6.98,6.98,'P','Trim joints / compatible seal interfaces.'),
]
hardware=[
('M','hinge','24 in. strap ONLY, N248-047',6,29.1,29.1,'P','CANDIDATE. Compatible pintles and bolts separate.'),
('N','pro','Matching pintles + rated fixings',1,100,180,'A','Quote pending; complete hinge assembly / jamb design.'),
('P','perimeter','9 ft jamb / header seal',3,15.57,15.57,'P','Candidate; test outward-swing clearance.'),
('Q','gasket','Meeting-edge gasket, 10 ft',1,6.97,6.97,'P','Candidate thickness; size to actual compression gap.'),
('R','pro','Continuous long bottom sweeps',2,30,60,'A','Quote pending. At least actual leaf width; 48 in. too short.'),
('S','bolt','18 in. cane bolt',2,18.93,18.93,'P','Candidate for passive-leaf top / bottom; verify orientation.'),
('T','latch','Deluxe latch set',1,32.97,32.97,'P','Candidate; confirm inside release, reach and thickness.'),
('U','pull','6-1/2 in. pull handle',4,8.22,8.22,'P','One per face per leaf; use frame-backed fixing.'),
('V','pro','Positive wind hold-open pair',1,60,120,'A','Quote pending. No friction kick-down stops.'),
('W','pro','Flashing / sleeves / consumables',1,65,110,'A','Drip detail, masking, abrasive, brushes, backing seal.'),
]
lo=sum(q*a for _,_,_,q,a,b,_,_ in materials+hardware)
hi=sum(q*b for _,_,_,q,a,b,_,_ in materials+hardware)

def shopping_rows(data):
    result=[]
    for code,key,name,q,a,b,status,desc in data:
        unit=f'${a:.2f}' if a==b else f'${a:.0f}-{b:.0f}'
        total=f'${q*a:.2f}' if a==b else f'${q*a:.0f}-{q*b:.0f}'
        result.append([code,product(name,URL[key])+'<br/><font color="#65777c">'+desc+'</font>',str(q),unit+' '+status,total])
    return result

start('Materials first','Two entirely new doors for the LEFT bay only. Existing pair: 257 x 216 cm; reference, not a verified opening.')
y=note('PLANNING ISSUE - DO NOT CUT OR ORDER CUSTOM PARTS',
       'Final opening sizes, joint / hinge details and safe jamb attachment must be checked before fabrication. No existing door parts are reused.',721,'hold',64)
y=table(['ID','Timber, panels and finish - click product names','Qty','Each','Total'],shopping_rows(materials),y,[25,277,34,72,111],8.6)
p('P = publicly displayed Home Depot price checked 12 Sep 2026. A = estimator allowance, not a store quote. Prices are USD, before tax and delivery; no local store selected.',M,y,519,9,GRAY)
end()

start('Hardware & project budget','Buy the complete approved hardware system, not just the visually similar items linked below.')
y=table(['ID','Hardware - linked candidates, not approvals','Qty','Each','Total'],shopping_rows(hardware),721,[25,277,34,72,111],8.4)
y=p(f'<b>Materials + hardware allowance: ${lo:,.0f}-${hi:,.0f}</b>',M,y,519,13)
y=p(f'Add 15% materials contingency (${lo*.15:,.0f}-${hi*.15:,.0f}), tools / rentals ($200-$450 if needed), and about 7% tax reserve. Planning total: <b>${(lo*1.15+200)*1.07:,.0f}-${(hi*1.15+450)*1.07:,.0f}</b>. Tax reserve is not a tax-rate determination.',M,y-12,519,10)
y=p('Excludes labor, delivery, permit / professional fees, hazardous-material work, jamb or structural repairs, glazing, and right-bay work. Hardware quotes can change this range materially.',M,y-12,519,9,GRAY)
end()

start('Tools & release checks','One small checkpoint before each phase; all unresolved questions are collected on the last page.')
y=table(['Measure / prepare','Cut / assemble','Finish / install'],[
['Tape, pencil, 1.8 m level, square, straightedge, winding sticks or straight battens. Moisture meter useful.','Circular saw with guide; supported cutting bench; sharp chisel / mallet or router with depth stop. Drill, bits, countersink, driver.','Random-orbit sander with dust extraction; brushes / roller; caulk gun; sockets / spanners.'],
['Eye and hearing protection; dust protection selected for the material / task.','At least 4 suitable clamps, two long enough for a leaf; flat cauls; rated trestles and solid blocking.','Helper(s), rated lifting / door-support equipment, wedges and a way to secure the opening overnight.']
],720,[173,173,173],10)
y=note('CHECK A / BEFORE DISTURBING THE OLD DOORS','Confirm local requirements with Westfield Building & Construction. Assess unknown old paint and suspect materials before scraping, drilling or sanding. Do not disturb the header, center post or siding.',y,'hold',86)
y=note('CHECK B / BEFORE CUTTING THE NEW DOORS','Select the complete hinge / seal system using a conservative weight estimate; its offsets set gaps and blocking. Have an exterior-door carpenter review the measured opening, frame, joints, adhesive and fasteners for this exposure.',y,'hold',86)
y=note('CHECK C / BEFORE HANGING','Have the hinge supplier / installer confirm the full hinge system for leaf width, finished weight, thickness, wind restraint and actual jamb timber. Hardware holes and attachment layout come from that approved detail.',y,'hold',86)
p('This is a fabrication-planning manual, not a tested, wind-rated, engineered or fire-rated door system. The checks above are genuine release conditions; accurate dimensions alone do not establish structural capacity.',M,y,519,10)
end()

start('What we are building','Solid upper panels, a lower carriage-style X, concealed internal braces and a shallow insulated cavity.')
imagebox();door(92,444,170,242,'finish',hinges=True);door(270,444,170,242,'finish',mirror=True,hinges=True)
text('LEFT / passive',103,433,9);text('RIGHT / active',318,433,9)
dim(92,696,440,696,'PAIR - SIZE PENDING')
y=p('<b>View from driveway:</b> both leaves swing outward. The right leaf opens first; an exterior astragal fixed to it overlaps the left leaf. The original center structural post between garage bays stays untouched.',M,386,519,11)
y=table(['Outside to inside','Planning thickness / purpose'],[
['Painted pine trim','About 19 mm; appearance and seam cover, not the anti-sag brace.'],
['Exterior plywood skin','15/32 in. (about 12 mm), screwed to the frame.'],
['Flat 2x4 frame + stone wool','Actual about 38 x 89 mm timber, lying flat; 38 mm deep cavity.'],
['Removable inner plywood','1/4 in. (about 6 mm); screwed on, not glued.']
],y-14,[180,339],10)
p('Approximate thickness: 56 mm without face trim; 75 mm at trim. Verify actual products. Insulation is a nonstandard custom-door use: no whole-door R-value or fire rating is claimed. This version has no windows; adding glazing requires a revised frame, safe glazing detail, weight check and budget.',M,y,519,10)
end()

start('01 / Survey the opening','Do this before cutting. Keep the old leaves installed while measuring wherever practical.')
imagebox();rect(137,450,297,222,TAN);rect(153,451,265,205,white)
line(153,451,418,656,TEAL,1.4);line(153,656,418,451,TEAL,1.4)
dim(153,684,418,684,'CLEAR WIDTH');dim(438,451,438,656,'HEIGHT')
badge('D1',236,518);badge('D2',337,518)
text('Fixed jamb',62,555,9);arrow(114,558,140,558)
text('Floor / threshold reference',211,435,9)
y=steps([
'Measure clear width at top, middle and bottom; height at left, center and right. Measure between fixed surfaces, not over the old leaves or trim.',
'Measure both opening diagonals. Check jambs for plumb, header for level and the mounting faces for twist. A mismatch needs investigation, not a skewed door cut.',
'Mark each outward swing on the driveway. Use a level / straightedge to find the highest obstruction across the full swing and decide the final threshold / sweep arrangement.'
],387)
note('RECORD, THEN RELEASE','2570 x 2160 mm is the OLD DOOR PAIR, not W and H below. The 140 mm center post and 120 mm side / top timber widths are observations, not proof of depth, soundness or capacity.',y,'hold',73)
end()

start('Size & cut worksheet','All manufacturing dimensions are in millimeters. Leave blanks until CHECK B is complete.')
y=table(['Symbol','Meaning / formula','Final value'],[
['W','Usable corrected clear width at the new door plane.','________ mm'],
['H','Usable corrected clear height above the chosen floor / threshold reference.','________ mm'],
['gL / gR / gM','Left / right / meeting gaps from the selected hinge and seal detail.','____ / ____ / ____'],
['gT / gB','Head / bottom gaps; bottom clears highest point throughout the swing.','____ / ____'],
['L','Each equal leaf width = (W - gL - gR - gM) / 2.','________ mm'],
['D','Leaf height = H - gT - gB. Use only after floor / header geometry is resolved.','________ mm'],
['b / t','Actual frame face width / thickness, nominally 89 / 38.','____ / ____ mm'],
['e','Plywood joint gap at the middle rail; provisional 3 mm, confirm panel guidance.','________ mm']
],721,[62,349,108],9.5)
y=table(['Part / pair quantity','Finished size or method'],[
['A1 - stiles / 4','D long; half-laps at top, middle and bottom rail positions.'],
['A2 - rails / 6','L long, full width; end laps b long and t/2 deep. Middle rail centered at D/2.'],
['A3 - braces / 4','Scribe in each assembled half-frame. No fixed angle / final length yet.'],
['B - outer half-panels / 4','L wide x (D - e)/2 high; seam centered on the middle rail.'],
['C - inner half-panels / 4','Same envelope as B; field-fit after seal and hardware clearance check.'],
['D - decorative trim','Stiles D; horizontal pieces L - 2 x actual trim width. X pieces scribed.']
],y,[182,337],9)
p('Check nesting before purchase: rotated half-panels must fit within a 2440 x 1220 mm sheet with saw kerf and edge trimming. This 4-sheet-per-skin allowance applies only while L < 2440 and (D - e)/2 < 1220. No dimensions on this page are released cut sizes.',M,y,519,9,GRAY)
end()

start('02 / Cut the frame & half-laps','Parts A1 + A2. Work on a supported bench with the saw / router manufacturer\'s safety instructions.')
imagebox()
rect(85,516,165,35,TAN);rect(250,516,42,17,TAN);rect(250,599,42,60,TAN);rect(250,582,42,17,TAN)
arrow(270,574,270,550);text('Remove half the thickness',69,482,11)
dim(302,516,302,551,'t');dim(250,566,292,566,'b')
rect(361,480,44,174,TAN);rect(361,549,44,28,LIGHT)
arrow(447,563,410,563);text('Middle lap',423,586,10)
text('Practice on two offcuts first',82,677,11,TEAL)
y=steps([
'Select straight, dry, sound boards without cracks or loose knots at the joints or hinge locations. Measure actual b and t. Reject badly bowed or twisted pieces.',
'Cut four stiles and six rails to the released worksheet. Label each leaf and keep paired pieces together. Mark all lap faces so rails and stiles interlock flush.',
'On scrap, set cutting depth to t/2. Make shallow passes, then pare flat. Cut corner laps and the middle-rail housings; test-fit every joint without forcing it.'
],387)
note('DONE WHEN','Mating faces contact fully and the assembled frame stays one thickness. Do not use glue or filler to bridge badly cut joints.',y,height=60)
end()

start('03 / Square & assemble each frame','Parts A1 + A2 + F + G. Flat frame first; braces come next.')
imagebox();door(170,447,174,234,'frame',brace=False)
line(170,447,344,681,TEAL);line(344,447,170,681,TEAL)
for xx,yy in [(170,447),(344,447),(170,681),(344,681)]:badge('C',xx,yy)
text('Check diagonals',62,651,10);text('Keep frame flat',62,635,10);arrow(140,625,178,614)
text('Clamp the laps',369,560,10);arrow(366,549,345,549)
y=steps([
'Dry-assemble one frame on a verified flat bench. Check both diagonals, outside dimensions and flatness. Adjust until the frame is square without twist.',
'After CHECK B accepts the exterior-door adhesive / joint detail, spread the approved glue on clean, unpainted lap faces. Reassemble, clamp with flat cauls, and recheck diagonals before the glue sets.',
'For the planning joint detail, predrill and retain each lap with two staggered #8 x 1-1/4 in. screws from the lap side; verify no tip protrudes. Final joint / screw acceptance is part of CHECK B.',
'Keep the frame supported and clamped for the adhesive\'s stressed-joint cure requirement. Allow at least 24 hours before loading, or longer if the product / conditions require.'
],387)
note('GLUE LIMIT','Titebond III excludes structural / load-bearing use and directs exterior-door users to technical support. Obtain approval or revise the adhesive / joint detail before assembly; the screws shown are not a rated connection.',y,'hold',75)
end()

start('04 / Fit the internal anti-sag braces','Part A3. Outside view, skin omitted. The brace direction follows the hinge side, not the decorative X.')
imagebox();door(99,449,159,236,'frame');door(316,449,159,236,'frame',mirror=True)
text('Hinges left',96,435,9);text('Hinges right',391,435,9)
arrow(126,486,222,550);arrow(445,486,349,550)
text('LOWER HINGE CORNER -> UPPER MEETING-SIDE CORNER',86,695,8,TEAL)
y=steps([
'Fit one brace in each half of the frame: lower hinge-side corner to the opposite upper corner. Mirror the arrangement for the other leaf.',
'Lay the brace stock over the opening, mark the actual intersections, then cut and test-fit. Form snug bearing faces against the stile / rail corners; do not copy an assumed 45-degree angle.',
'Glue the bearing faces and hold the braces flush with the frame using temporary clamps / cleats. Keep the frame square while curing; the outer skin in Step 05 fixes into each brace.',
'If a brace can move without bearing at its ends, recut it. Do not substitute the face X trim, a thin strap or screws into end grain for a fitted compression brace.'
],387)
note('DONE WHEN','Both halves have snug braces, every member is in the same plane, and the door remains square. Confirm the brace / skin connection at CHECK B.',y,height=60)
end()

start('05 / Cut & screw on the outer skin','Part B + G. Four sheets for the pair at the reference width; horizontal joints simplify the frame.')
imagebox()
rect(67,451,221,119,HexColor('#e7d5b9'));rect(67,451,122,107,HexColor('#d0b080'))
dim(67,592,288,592,'2440 mm STOCK');text('One half-panel per sheet',74,614,11)
text('Keep offcut for other projects',74,434,9)
door(378,454,128,222,'solid');line(375,565,509,565,TEAL,3)
arrow(237,553,366,600);text('Seam on middle rail',349,688,10)
arrow(419,675,441,570)
y=steps([
'Confirm the panel stamp says Exterior. Cut four half-panels to the worksheet, with finished faces outward. Seal fresh panel edges with the compatible primer and let dry.',
'Position each pair with the confirmed joint gap centered on the middle rail. Keep the outside edges flush. Mark the stiles, all rails and braces on the skin so every fixing reaches wood.',
'Planning fastening pattern: #8 x 1-1/4 in. exterior screws at 150 mm along panel perimeter / middle joint and 200 mm along braces. Predrill, keep screw centers at least 10 mm from panel edges, and avoid splitting the frame. CHECK B must accept the final pattern.',
'Drive heads just flush, not through the face veneer. Fasten from the middle outward while the frame stays flat. Do not glue across the plywood expansion joint.'
],387)
note('DONE WHEN','All panel edges are backed by the frame and every brace is connected to the skin. No unsupported seam or missed framing. Do not treat this draft pattern as a wind-load design.',y,height=65)
end()

start('06 / Fit the carriage-style trim','Part D + H + L. Trim is decorative; keep the internal bracing unchanged.')
imagebox();door(96,444,166,247,'solid');arrow(276,563,315,563);door(345,444,166,247,'trim')
text('Skin + backed middle seam',81,433,9);text('Finished face layout',367,433,9)
y=steps([
'Prime trim backs and all ends before fitting. Install the two vertical edge trims, then the top, middle and bottom horizontal trims between them. Place the middle trim over the sheet joint.',
'Scribe the lower X to the real opening. Use one full diagonal and two infill pieces butted to it, all in one plane. Do not stack the two boards at the crossing.',
'Predrill and fix straight trim at about 300 mm centers using #8 x 2 in. screws: about 20 mm into the frame with 19 mm trim + 12 mm skin. For the X, mark fixings over braces; use the 2 reserved boards for frame-connected blocking behind other fixing points before insulating.',
'At the middle seam, install a compatible flexible flashing strip behind the cover rail, bridging the panel gap as its instructions permit. Seal the rail top / ends and preserve drainage below. Slope or cap horizontal trim to shed water; prime all fresh cuts.'
],387)
note('DONE WHEN','The X is flat, trim screws reach solid wood, the middle seam is protected, and water can drain at the base. The finish / flashing detail is part of the pre-build review.',y,height=65)
end()

start('07 / Insulate & close the inside','Parts E + C + G. Use rigid stone wool, not an exposed foam substitute.')
imagebox();door(94,447,158,236,'insulate');arrow(268,564,321,564);door(347,447,158,236,'lining')
text('38 mm cavity',119,434,9);text('Removable plywood cover',358,434,9)
y=steps([
'Finish / seal the accessible cavity wood and the back of the exterior plywood after the frame glue has cured. Let it dry fully before insulation; keep rain out of the work area.',
'Cut 1-1/2 in. (about 38 mm) Comfortboard to each actual triangular cavity. Fit snugly without bowing the lining; do not pack wet material or force excess thickness into the frame.',
'Make a cut layout before opening the pack. The 48 sq ft allowance is based on the smaller cavity area after subtracting the frame and braces; verify offcut reuse and waste.',
'Prime both sides / edges of the inner plywood, then screw it to the frame and braces at the Step 05 planning spacing. Keep the middle joint backed and hinge nuts accessible. Do not glue the lining; fully contain the mineral fibers.'
],387)
note('MATERIAL LIMIT','Stone wool is noncombustible; the finished timber door is not fire-rated. Comfortboard is normally wall sheathing, not a tested door kit. Confirm this custom use and moisture detail; do not claim a whole-door R-value.',y,'hold',70)
end()

start('08 / Finish every exposed surface','Parts J + K + L. Protect the bottom edge especially carefully.')
imagebox();door(212,449,163,234,'finish')
for xx,yy,tx,ty in [(161,659,211,659),(426,659,377,659),(162,479,211,479),(426,479,377,479),(293,706,293,685),(293,426,293,449)]:arrow(xx,yy,tx,ty)
text('Front + back + all four edges',65,693,9)
text('Bottom edge',405,493,10)
y=steps([
'Lightly smooth new timber and veneer with suitable abrasives and dust extraction. Ease sharp edges lightly so paint can wrap them. Do not sand the old painted doors as part of this step.',
'Prime bare wood, cuts, filled holes and fresh hardware holes. Follow the primer label for ventilation, temperature, recoat timing and oily / solvent waste handling.',
'Apply two compatible exterior finish coats to front, back and all four edges, including behind removable hardware where practical. Keep pivot surfaces, gasket contact faces and drains free of paint buildup.',
'Let the coating cure sufficiently before stacking, hanging or compressing seals. Recoat any cut / drilled surface exposed during installation.'
],387)
note('DONE WHEN','No raw end grain or panel edge remains exposed. Paint is a maintained protective finish, not a substitute for drainage or clearance above wet paving.',y,height=65)
end()

start('09 / Confirm & dry-fit the hardware','CHECK C must be complete. The 24 in. strap link is a candidate component, not a ready-to-install hinge set.')
imagebox();door(114,447,173,239,'finish',hinges=True)
rect(364,478,28,155,TAN);rect(411,508,76,25,TAN);line(405,510,405,566,INK,5)
c.setFillColor(INK);c.circle(405,536,7,fill=1,stroke=0)
text('Jamb',356,650,10);text('Door',439,547,10)
text('Pintle / offset',411,581,10);arrow(444,575,406,544)
text('Three shown; final count / positions by supplier',75,434,8)
y=steps([
'Verify the preselected hinge system against the finished leaf weight, including hardware. For early planning only, allow roughly 60-70 kg per leaf; actual products can differ. Never choose hinges from this estimate alone.',
'Confirm matched straps and pintles, corrosion protection, required hinge count / spacing, opening angle, anti-lift retention and all bolt / washer / backing requirements. Do not add individual catalog load figures together.',
'Dry-fit hardware to one leaf on the bench. Straps must bear on supported, coplanar mounting areas and connect to structural timber, not just the decorative skin. Add reviewed blocking where needed.',
'Transfer holes with the supplied template. Use the specified diameters, distances and corrosion-compatible fasteners; protect drilled wood. Leave installation to the approved jamb detail in Step 10.'
],387)
note('STOP IF UNRESOLVED','The 120 / 140 mm timber face widths do not establish jamb depth or soundness. No generic lag length, pintle size, bolt pattern or wind capacity is authorized by this manual.',y,'hold',69)
end()

start('10 / Remove the old leaves & hang','Do this only after the new pair is ready and the hazards / jamb / hardware checks are closed.')
imagebox();rect(100,447,18,230,TAN);rect(450,447,18,230,TAN);rect(100,677,368,15,TAN)
door(126,457,156,211,'finish',hinges=True);door(289,457,156,211,'finish',mirror=True,hinges=True)
for xx in (144,239,305,400):rect(xx,445,27,10,TAN)
text('Rated support + measured gap blocks',162,432,10)
arrow(80,575,121,575);arrow(502,575,450,575)
y=steps([
'With helpers and rated lifting / support equipment, secure each old glazed leaf before releasing any hardware. Remove only the leaves and obsolete door hardware; protect the opening and retain all structural timber.',
'Inspect the newly exposed mounting timber. Soft wood, cracking, loose joints or movement stops installation. Do not cover damage with a new mounting block or longer screws.',
'Place the passive left leaf on firm supports at its released height. Plumb the hinge axis, establish head / side gaps with blocks, then attach the matched hardware using the approved detail.',
'Support and hang the right leaf to match. Keep supports in place until all connections are secure. Open slowly through the full planned swing, then check gaps without lifting the latch edge.'
],387)
note('DONE WHEN','Both leaves swing without rubbing or lifting, the hinge axes are stable, and supports can be removed safely. Work in calm conditions; never leave an unsecured leaf free to swing.',y,height=65)
end()

start('11 / Add the stops, astragal & seals','Parts D + P + Q + R. Close the left leaf first; close the right leaf second.')
imagebox()
text('TOP VIEW / MEETING EDGE',66,674,10,TEAL)
rect(81,552,165,43,TAN);rect(259,552,167,43,TAN)
rect(224,596,117,18,white);rect(224,590,22,5,TEAL)
text('LEFT / passive',86,534,10);text('RIGHT / active',285,534,10)
text('Outside / driveway',216,648,10);text('Inside / garage',218,479,10)
arrow(309,584,309,627);text('Right opens first',357,640,10)
text('Astragal fixed to RIGHT only',68,462,10);arrow(212,478,284,606)
text('Gasket on overlap',378,510,10);arrow(416,521,234,591)
y=steps([
'Fit inside jamb / header stops so closed doors contact a compressible seal. An 8 ft board is shorter than this header: use two stop sections, each fixed to continuous sound backing, with a sealed joint. Stops must clear the outward swing and straps.',
'Fit a full-height exterior astragal to the right active leaf only. Field-size its overlap and gasket so it covers the meeting gap and compresses against the left leaf without binding.',
'Fit continuous bottom sweeps long enough for each leaf. Confirm a smooth, drainable threshold contact surface and that the sweep clears the entire swing. Do not join short sweeps across the opening or make asphalt carry a structural anchor.',
'Check weatherstrip contact at corners and intersections. Adjust stops and seals rather than forcing a stiff latch. Keep the outside drainage path open; do not create a water dam at the threshold.'
],387)
note('DONE WHEN','A light paper strip feels consistent resistance around the closed perimeter. Right leaf opens first and closes last. Seal profile / compression and bottom gap are actual product-dependent dimensions.',y,height=67)
end()

start('12 / Fit the latch & wind restraints','Parts S + T + U + V. All hardware connects to solid, reviewed mounting points.')
imagebox();door(96,448,170,237,'finish',hinges=True);door(274,448,170,237,'finish',hinges=True,mirror=True)
rect(245,646,5,26,INK);rect(245,461,5,30,INK);rect(245,559,59,7,INK)
badge('1',239,687);badge('2',81,466);badge('3',291,581)
text('1 / top bolt',454,654,9);text('2 / lower bolt',454,631,9);text('3 / latch',454,608,9)
text('Wind hold-opens are separate from the closed-door latch',76,434,9)
y=steps([
'Secure the passive leaf with the reviewed top and bottom bolt arrangement. The linked cane bolt is only a candidate: confirm it is suitable for each orientation and remains captured / restrained when retracted.',
'Use appropriate receivers in verified sound structure. Before any slab drilling, establish concrete integrity, edge distances and hidden services. If these are unknown, stop that fixing and obtain a suitable alternative detail.',
'Fit the active-leaf latch and pulls to backed timber. Confirm the astragal does not obstruct the mechanism and that a person inside can release it without being trapped. Coordinate with any required exit route.',
'Install a positive hold-open for each leaf at its planned open position, using supplier-approved anchorage. A friction kick-down stop or loose weight is not a wind restraint; close and secure the doors before strong winds.'
],387)
note('DONE WHEN','Bolts fully engage, the latch works without lifting the leaf, inside release works, and neither open leaf can swing freely. These details do not create a tested wind rating.',y,height=63)
end()

start('13 / Test, adjust & maintain','Complete the check before normal use; keep this page with your final hardware instructions.')
imagebox();door(126,449,163,235,'finish',hinges=True);door(296,449,163,235,'finish',hinges=True,mirror=True)
for xx,yy,label in [(114,650,'A'),(289,564,'B'),(454,456,'C')]:badge(label,xx,yy)
text('A / stable hinges',73,694,10);text('B / easy closing',243,694,10);text('C / dry base',412,694,10)
y=steps([
'Cycle both leaves slowly at least ten times. Check rubbing, shifting hardware, loosening joints, latch alignment and the right-first opening sequence. Stop if movement or splitting develops.',
'Inspect the sealed perimeter from inside with daylight outside. Check again after normal rain; identify the entry path before adding sealant. Do not pressure-wash the door to test it.',
'Record finished leaf weights, final gaps, hinge model, fixings and photographs. Complete any required inspection. Keep all product instructions with the manual.',
'Recheck after the first week and after the first wet / cold weather change. Inspect seasonally: bottom paint edges, panel seams, hinges, bolts, hold-opens and moisture behind the removable lining. Repair worn finish before raw wood becomes exposed.'
],387)
note('HEATING LIMIT','This insulated door alone does not make the garage an insulated room. Use heating equipment only as its instructions permit; never use grills, generators or vehicle exhaust for heat inside the garage.',y,height=65)
end()

start('References & purchase notes','Sources checked 12 Sep 2026. Product names on pages 1-2 are clickable Home Depot purchase links.')
sources=[
('1 / Project scope',None,'Two new left-bay leaves, no reused door parts. Current pair 257 x 216 cm is user-supplied. Center post 14 cm; left / top timber face widths 12 cm. Depth, condition, clear opening and diagonals remain unverified.'),
('2 / Home Depot product listings','https://www.homedepot.com/b/Lumber-Composites-Plywood-Sanded-Plywood/N-5yc1vZc7qk','Prices marked P were publicly displayed product / category prices. No selected Westfield store, local stock, delivery or checkout price was verified. Plywood prices matched models 201429 and 235552. Timber / insulation / long sweeps / hold-opens include explicit allowances.'),
('3 / ROCKWOOL Comfortboard','https://www.rockwool.com/north-america/products/comfortboard/','Manufacturer describes a noncombustible stone-wool sheathing board. Its use between moving custom-door skins is a design proposal, not a manufacturer-certified door system. Nominal board insulation performance is not whole-door performance.'),
('4 / APA Sanded Plywood Guide','https://www.murphyplywood.com/pdfs/softwood/APA_Sanded_Plywood_Guide.pdf','Confirm the actual panel classification and installation information. Exterior and Exposure 1 are different bond classifications; this weather-exposed outer skin specifies Exterior. Joint spacing and fastening must suit this application.'),
('5 / Titebond III technical data','https://www.titebond.com/product/wood-glues/e8d40b45-0ab3-49f7-8a9c-b53970f736af','The manufacturer excludes structural / load-bearing use and directs exterior-door users to technical support. Confirm or replace this adhesive before assembly. Current instructions govern temperature, working time, clamping and cure.'),
('6 / National Hardware strap candidate','https://www.national-hardware.com/p/294-hinge-straps?model=N248-047','N248-047 is a strap component. Obtain written confirmation of its matching hook / pintle, door-width and weight basis, hinge count, offsets and attachment requirements. Catalog safe-working-load figures are not a completed-door approval.'),
]
y=718
for title,url,body in sources:
    y=p(product(title,url) if url else '<b>'+title+'</b>',M,y,519,12)
    y=p(body,M,y-7,519,10)-23
end()

start('Release sheet / questions together','Fill this once. No need for another general photo survey; only targeted checks to close the gaps below.')
y=table(['Field','Record'],[
['Clear widths: top / middle / bottom','________ / ________ / ________ mm'],
['Clear heights: left / center / right','________ / ________ / ________ mm'],
['Opening diagonals: D1 / D2','________ / ________ mm'],
['Jamb depth / condition; swing high point','_____________________________________'],
['Released leaf L x D; gL/gR/gM/gT/gB','_____________________________________'],
['Final hinge + pintle + bolt / anchor detail','_____________________________________'],
['Finished weight: left / right','________ / ________ kg'],
['Frame / fastening review, name + date','_____________________________________'],
['Local requirements / inspection decision','_____________________________________']
],721,[254,265],10)
y=p('<b>Questions to resolve before release</b>',M,y,519,12)
y=p('What are the final corrected opening and swing-clearance dimensions? Which complete hinge / attachment system is accepted for the finished leaf weight and jambs? Does local review require any change to this custom assembly or its installation?',M,y-8,519,10)-19
y=p(product('Westfield Building & Construction','https://www.westfieldnj.gov/547/Building-Construction')+' - confirm requirements for replacement leaves; do not assume the separate right-bay alteration has the same permit scope.',M,y,519,9.5)-14
y=p(product('EPA lead-safe DIY guidance','https://www.epa.gov/lead/lead-safe-renovations-diyers')+' - assess old paint before disturbance; use the appropriate lead-safe process. '+product('EPA asbestos guidance','https://www.epa.gov/asbestos/protect-your-family-exposures-asbestos')+' - leave suspect siding / sheet materials undisturbed pending assessment.',M,y,519,9.5)-17
note('READY FOR THE NEXT REVISION','Once the measurements and review details are available, replace the blanks with a released cut list and final hardware schedule. The numbered assembly sequence can remain the same unless the reviewed design changes.',y,height=76)
end()

c.save()
print(f'Created {OUT} | {len(PAGES)} pages')
print(f'Materials range: {lo:.2f} - {hi:.2f}')
print(f'Planning total incl tools, contingency, tax reserve: {(lo*1.15+200)*1.07:.2f} - {(hi*1.15+450)*1.07:.2f}')

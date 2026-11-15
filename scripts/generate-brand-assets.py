"""Generate the exact Aethra vector assets. Requires fonttools and Pillow.

Pass the official Outfit variable TTF using --font. The raster step is in
render-brand-assets.mjs and uses @resvg/resvg-js as a development tool only.
"""
from pathlib import Path
import argparse, json, shutil
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = Path(__file__).resolve().parents[1]
MARK = '''<g stroke="currentColor" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round">
<path d="M177.94 55 A90 90 0 1 1 145 22.06"/><path d="M60.4 136 L100 55 L139.6 136"/><path d="M72.7 111 H127.3"/></g>
<g fill="currentColor"><circle cx="163.64" cy="36.36" r="7.65"/><circle cx="100" cy="55" r="7.65"/><circle cx="60.4" cy="136" r="7.65"/><circle cx="139.6" cy="136" r="7.65"/></g>'''

parser = argparse.ArgumentParser()
parser.add_argument('--font', type=Path, required=True)
args = parser.parse_args()
output = ROOT / 'client/public/brand'
(output / 'fonts').mkdir(parents=True, exist_ok=True)
if args.font.resolve() != (output / 'fonts/outfit.ttf').resolve():
    shutil.copyfile(args.font, output / 'fonts/outfit.ttf')
license_file = args.font.with_name('OFL.txt')
if license_file.exists() and license_file.resolve() != (output / 'fonts/OFL.txt').resolve():
    shutil.copyfile(license_file, output / 'fonts/OFL.txt')
font = instantiateVariableFont(TTFont(args.font), {'wght': 400}, inplace=False)
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
paths, advance, bounds = [], 0, []
for character in 'Aethra':
    glyph_name = cmap[ord(character)]
    pen, bound = SVGPathPen(glyphs), BoundsPen(glyphs)
    glyphs[glyph_name].draw(pen); glyphs[glyph_name].draw(bound)
    paths.append(f'<path transform="translate({advance} 0)" d="{pen.getCommands()}"/>')
    bounds.append(bound.bounds)
    advance += font['hmtx'][glyph_name][0] + font['head'].unitsPerEm * .01
scale = 168 / font['head'].unitsPerEm
baseline = 100 + (max(b[3] for b in bounds) + min(b[1] for b in bounds)) * scale / 2
inner = MARK + f'<g fill="currentColor" transform="translate(272 {baseline}) scale({scale} {-scale})">'+''.join(paths)+'</g>'
width, clear = 272 + advance * scale, 45.9
full_width, full_height = width + clear*2, 200 + clear*2
def svg(body, box, color, title='Aethra'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}" fill="none" style="color:{color}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'
for filename, color in [('aethra-logo.svg','#1AD6F7'),('aethra-logo-light.svg','#FFFFFF'),('aethra-logo-dark.svg','#0B1426')]:
    (output/filename).write_text(svg(f'<g transform="translate({clear} {clear})">{inner}</g>',f'0 0 {full_width} {full_height}',color),encoding='utf-8')
(output/'aethra-mark.svg').write_text(svg(MARK,'0 0 200 200','#1AD6F7'),encoding='utf-8')
# Mark occupies 60% of the app icon canvas, with generous clear space.
icon = '<rect width="1024" height="1024" rx="224" fill="#07142B"/>' + f'<g transform="translate(204.8 204.8) scale(3.072)">{MARK}</g>'
(output/'app-icon.svg').write_text(svg(icon,'0 0 1024 1024','#1AD6F7'),encoding='utf-8')
(output/'favicon.svg').write_text(svg(icon,'0 0 1024 1024','#1AD6F7'),encoding='utf-8')
og_scale = min(1040/full_width, 420/full_height)
og = '<rect width="1200" height="630" fill="#07142B"/>' + f'<g transform="translate({(1200-full_width*og_scale)/2} {(630-full_height*og_scale)/2}) scale({og_scale})"><g transform="translate({clear} {clear})">{inner}</g></g>'
(output/'og-image.svg').write_text(svg(og,'0 0 1200 630','#1AD6F7'),encoding='utf-8')
manifest = {'name':'Aethra — Customer Relationship Management','short_name':'Aethra','description':'Every relationship, in orbit.','start_url':'/','scope':'/','display':'standalone','background_color':'#EEF2F8','theme_color':'#07142B','lang':'ar','dir':'rtl','icons':[{'src':f'/brand/icon-{size}.png','sizes':f'{size}x{size}','type':'image/png','purpose':'any'} for size in [192,512]]}
(output/'site.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Generated vector logos, icon, social card and manifest with Outfit 400 outlines.')

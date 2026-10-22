"""Build the original Research Bridge vector mark and local icon assets."""
from pathlib import Path
import hashlib
import json
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
MAIN = 'M18 106 Q12 106 12 100 V60 Q12 54 18 56 L42 66 Q45 67 45 71 Q45 77 41 80 L35 85 C48 78 61 75 73 78 V56 Q73 54 76 53 L111 37 Q116 35 116 41 V100 Q116 106 110 106 H90 C90 75 35 75 35 106 Z'
LEFT = 'M17 54 V47 Q17 43 20 45 L42 55 Q45 57 45 61 V65 Z'
RIGHT = 'M73 51 V42 Q73 37 77 35 L103 19 Q106 17 106 21 V36 Z'

def mark(ink, fold):
    return f'<path fill="{ink}" d="{MAIN}"/><path fill="{fold}" d="{LEFT}"/><path fill="{fold}" d="{RIGHT}"/>'

def svg(ink='#23655b', fold='#8bcac4'):
    return '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><title>Research Bridge — 研桥</title>'+mark(ink, fold)+'</svg>\n'

def main():
    assets = ROOT / 'content/icons'
    assets.mkdir(exist_ok=True)
    vectors = {'research-bridge': svg(), 'research-bridge-light': svg('#284a43', '#284a43'),
               'research-bridge-dark': svg('#eef8f5', '#eef8f5')}
    for name, source in vectors.items():
        (ROOT / 'icons' / (name+'.svg')).write_text(source, encoding='utf-8')
        for size in [16, 20, 24, 32, 48, 64, 96, 128, 256, 512]:
            cairosvg.svg2png(bytestring=source.encode(), write_to=str(assets/f'{name}-{size}.png'),
                            output_width=size, output_height=size)
    # Keep legacy marks in the design archive, outside both XPI and source allowlists.
    archive = ROOT / 'design/brand-concepts/legacy-icons'
    for folder in [ROOT/'icons', assets]:
        for old in list(folder.glob('chatgpt*')) + ([folder/'provenance.json'] if folder.name=='icons' else []):
            if old.is_file():
                destination = archive / folder.name / old.name
                destination.parent.mkdir(parents=True, exist_ok=True)
                if destination.exists() and destination.read_bytes()!=old.read_bytes():
                    raise ValueError('Legacy archive has different contents: '+str(destination))
                destination.write_bytes(old.read_bytes())
                old.unlink()
    record = {'name':'研桥 / Research Bridge', 'version':1, 'created':'2026-10-21',
              'concept':'design/brand-concepts/research-bridge-v1.png',
              'design':'Original book leaves and bridge arch, approved by the project owner; manually redrawn as flat SVG.',
              'palette':{'primary':'#23655b','fold':'#8bcac4'},
              'files':{name+'.svg':hashlib.sha256(source.encode()).hexdigest() for name,source in vectors.items()}}
    (ROOT/'icons/brand-provenance.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    board = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="650" viewBox="0 0 1200 650"><rect width="1200" height="650" fill="#f6f6f1"/><text x="60" y="70" font-family="Segoe UI,sans-serif" font-size="26" fill="#284a43" letter-spacing="5">RESEARCH BRIDGE</text><text x="60" y="105" font-family="Segoe UI,sans-serif" font-size="16" fill="#68736d">Production vector · v0.6.1</text><g transform="translate(65 135) scale(3.2)">'+mark('#23655b','#8bcac4')+'</g><rect x="610" y="150" width="240" height="220" rx="20" fill="#252925"/><g transform="translate(645 165) scale(1.55)">'+mark('#eef8f5','#eef8f5')+'</g><rect x="875" y="150" width="240" height="220" rx="20" fill="white"/><g transform="translate(910 165) scale(1.55)">'+mark('#284a43','#284a43')+'</g><text x="610" y="430" font-family="Segoe UI,sans-serif" font-size="18" fill="#68736d">Native sidebar · 20 / 24 / 32 px</text>'
    for index,size in enumerate([20,24,32]):
        x=615+index*125
        board+=f'<rect x="{x-10}" y="470" width="72" height="64" rx="8" fill="#252925"/><g transform="translate({x+5} {482}) scale({size/128})">'+mark('#eef8f5','#eef8f5')+f'</g><text x="{x}" y="565" font-family="Segoe UI,sans-serif" font-size="15" fill="#68736d">{size} px</text>'
    board+='</svg>'
    preview=ROOT/'design/brand-concepts/research-bridge-production.svg'
    preview.write_text(board,encoding='utf-8')
    cairosvg.svg2png(bytestring=board.encode(),write_to=str(preview.with_suffix('.png')))
    print('Built Research Bridge SVG and PNG assets.')

if __name__=='__main__':main()

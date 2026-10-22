"""Build the same architecture-independent Zotero XPI on Windows or macOS."""
from pathlib import Path
import json, zipfile, hashlib

ROOT=Path(__file__).resolve().parent.parent
def main():
    version=json.loads((ROOT/'manifest.json').read_text(encoding='utf8'))['version']
    files=[ROOT/'bootstrap.js',ROOT/'manifest.json']
    for folder in ['content','icons','locale']:
        files.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and not any(x.startswith('codex-zotero-') for x in p.relative_to(ROOT).parts))
    destination=ROOT/'dist'/f'codex-for-zotero-{version}.xpi';destination.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for p in sorted(files):
            if p.is_symlink():raise ValueError('Source symlinks are not distributable')
            info=zipfile.ZipInfo(p.relative_to(ROOT).as_posix(),(2026,10,22,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            archive.writestr(info,p.read_bytes())
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        for p in files:assert archive.read(p.relative_to(ROOT).as_posix())==p.read_bytes()
    print(json.dumps({'path':str(destination),'version':version,'files':len(files),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}))
if __name__=='__main__':main()

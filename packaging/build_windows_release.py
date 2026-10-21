"""Assemble an allowlisted distribution; never read user profiles or credentials."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']
NAME = f'Codex-for-Zotero-{VERSION}-Windows'
DIST = ROOT / 'dist'
DEST = ROOT / 'release' / NAME
DOCS = ROOT / 'packaging' / 'windows'
XPI = DIST / f'codex-for-zotero-{VERSION}.xpi'
SOURCE_NAME = f'codex-for-zotero-{VERSION}-source.zip'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_files():
    files = [ROOT / 'manifest.json', ROOT / 'bootstrap.js', ROOT / 'build.ps1', ROOT / 'LICENSE', ROOT / 'THIRD-PARTY-NOTICES.txt']
    for folder in ['content', 'icons', 'locale', 'tests', 'packaging']:
        files += sorted(p for p in (ROOT / folder).rglob('*')
                        if p.is_file() and '__pycache__' not in p.parts
                        and not any(part.startswith('codex-zotero-') for part in p.relative_to(ROOT).parts))
    return files


def archive_bytes(entries):
    import io
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(entries.items()):
            info = zipfile.ZipInfo(name, (2026, 10, 21, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return output.getvalue()


def main():
    binary = XPI.read_bytes()
    # Require the XPI to contain exactly the distributable core and match saved sources.
    core = {p.relative_to(ROOT).as_posix(): p.read_bytes()
            for p in source_files()
            if p.relative_to(ROOT).parts[0] in ['content', 'icons', 'locale']
            or p.name in ['manifest.json', 'bootstrap.js']}
    with zipfile.ZipFile(XPI) as package:
        if set(package.namelist()) != set(core):
            raise ValueError('XPI file list differs from the core source allowlist')
        for name, data in core.items():
            if package.read(name) != data:
                raise ValueError(f'XPI differs from saved source: {name}; rebuild XPI first')
    content = {XPI.name: binary}
    for name in ['安装与使用说明.md', '常用提问示例.md', '版本说明.md', '界面与对话管理.md',
                 'THIRD-PARTY-NOTICES.txt', '检查环境.cmd']:
        text = (DOCS / name).read_text(encoding='utf-8').replace('__XPI_SHA256__', digest(binary))
        if name.endswith('.cmd'):
            text = text.replace('\r\n', '\n').replace('\n', '\r\n')
        content[name] = text.encode('utf-8')
    html = (DOCS / 'guide.template.html').read_text(encoding='utf-8')
    marked = (ROOT / 'content/vendor/marked/marked.umd.js').read_text(encoding='utf-8')
    guide = json.dumps(content['安装与使用说明.md'].decode('utf-8'), ensure_ascii=False)
    guide = guide.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    html = html.replace('__VERSION__', VERSION).replace('__MARKED_JS__', marked).replace('__GUIDE_JSON__', guide)
    content['开始这里.html'] = html.encode('utf-8')
    for name in ['reading.png', 'study.png']:
        content['images/' + name] = (DOCS / 'images' / name).read_bytes()
    source = {f'codex-for-zotero-{VERSION}/' + p.relative_to(ROOT).as_posix(): p.read_bytes()
              for p in source_files()}
    source[f'codex-for-zotero-{VERSION}/README.md'] = (ROOT / 'packaging/SOURCE_README.md').read_bytes()
    source[f'codex-for-zotero-{VERSION}/使用说明.md'] = (ROOT / 'README.md').read_bytes()
    content[SOURCE_NAME] = archive_bytes(source)
    content['SHA256SUMS.txt'] = ''.join(f'{digest(data)}  {name}\n'
                                     for name, data in sorted(content.items())).encode('utf-8')
    # Never erase old release directories. Fail on unexpected files or links.
    if DEST.is_symlink():
        raise ValueError('Release directory may not be a link')
    if DEST.exists():
        unexpected = [p for p in DEST.rglob('*') if p.is_symlink()
                      or p.is_file() and p.relative_to(DEST).as_posix() not in content]
        if unexpected:
            raise ValueError('Unexpected existing release contents; use a new release directory')
    for name, data in content.items():
        output = DEST / name
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
    bundle = DIST / (NAME + '.zip')
    bundle.write_bytes(archive_bytes({NAME + '/' + name: data for name, data in content.items()}))
    (DIST / (NAME + '.zip.sha256')).write_text(f'{digest(bundle.read_bytes())}  {bundle.name}\n', encoding='utf-8')
    print(json.dumps({'zip': str(bundle), 'bytes': bundle.stat().st_size,
                      'sha256': digest(bundle.read_bytes()), 'xpi_sha256': digest(binary),
                      'files': sorted(content)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

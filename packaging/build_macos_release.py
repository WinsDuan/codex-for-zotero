"""Package macOS documentation/tools and portable XPI without user data."""
from pathlib import Path
import io,json,hashlib,zipfile
from build_windows_release import source_files
ROOT=Path(__file__).resolve().parent.parent
VERSION=json.loads((ROOT/'manifest.json').read_text(encoding='utf8'))['version']
NAME=f'Codex-for-Zotero-{VERSION}-macOS'
def digest(data):return hashlib.sha256(data).hexdigest()
def archive_bytes(entries):
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for name,data in sorted(entries.items()):
            info=zipfile.ZipInfo(name,(2026,10,22,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            info.create_system=3;info.external_attr=(0o100755 if name.endswith('.command') else 0o100644)<<16
            archive.writestr(info,data)
    return output.getvalue()
def main():
    xpi=ROOT/'dist'/f'codex-for-zotero-{VERSION}.xpi';binary=xpi.read_bytes()
    core={p.relative_to(ROOT).as_posix():p.read_bytes() for p in source_files() if p.relative_to(ROOT).parts[0] in ['content','icons','locale'] or p.name in ['bootstrap.js','manifest.json']}
    with zipfile.ZipFile(io.BytesIO(binary)) as z:
        if set(z.namelist())!=set(core):raise ValueError('XPI does not match source allowlist')
        for name,data in core.items():
            if z.read(name)!=data:raise ValueError('Rebuild XPI: '+name)
        assert z.testzip() is None
    content={xpi.name:binary,'LICENSE':(ROOT/'LICENSE').read_bytes()}
    for name in ['安装与使用说明.md','Mac验收步骤.md','验证状态.md','检查环境.command','check-environment.js']:
        data=(ROOT/'packaging/macos'/name).read_bytes()
        if name.endswith(('.command','.js')):data=data.replace(b'\r\n',b'\n')
        content[name]=data
    content['THIRD-PARTY-NOTICES.txt']=(ROOT/'packaging/windows/THIRD-PARTY-NOTICES.txt').read_text(encoding='utf8').replace('0.6.5',VERSION).encode('utf8')
    guide=json.dumps(content['安装与使用说明.md'].decode('utf8'),ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e').replace('&','\\u0026')
    html=(ROOT/'packaging/windows/guide.template.html').read_text(encoding='utf8').replace('Windows','macOS').replace('Microsoft YaHei','PingFang SC').replace('__VERSION__',VERSION).replace('__MARKED_JS__',(ROOT/'content/vendor/marked/marked.umd.js').read_text(encoding='utf8')).replace('__GUIDE_JSON__',guide)
    html=html.replace('<figcaption>','<figcaption>合成界面示例，并非 Mac 实机截图。')
    content['开始这里.html']=html.encode('utf8')
    for name in ['reading.png','study.png']:content['images/'+name]=(ROOT/'packaging/windows/images'/name).read_bytes()
    content['images/research-bridge.png']=(ROOT/'content/icons/research-bridge-128.png').read_bytes()
    files=source_files()+[ROOT/'.github/workflows/compatibility.yml']
    if any(p.is_symlink() for p in files):raise ValueError('Source links are not distributable')
    source={f'codex-for-zotero-{VERSION}/'+p.relative_to(ROOT).as_posix():p.read_bytes() for p in files}
    source[f'codex-for-zotero-{VERSION}/README.md']=(ROOT/'packaging/SOURCE_README.md').read_bytes()
    source[f'codex-for-zotero-{VERSION}/使用说明.md']=content['安装与使用说明.md']
    content[f'codex-for-zotero-{VERSION}-source.zip']=archive_bytes(source)
    content['SHA256SUMS.txt']=''.join(f'{digest(data)}  {name}\n' for name,data in sorted(content.items())).encode('utf8')
    destination=ROOT/'release'/NAME
    if destination.is_symlink():raise ValueError('Release path must not be a link')
    if destination.exists() and any(p.is_symlink() or p.is_file() and p.relative_to(destination).as_posix() not in content for p in destination.rglob('*')):raise ValueError('Unexpected existing release contents')
    for name,data in content.items():
        output=destination/name;output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(data)
    bundle=ROOT/'dist'/(NAME+'.zip');bundle.parent.mkdir(exist_ok=True)
    bundle.write_bytes(archive_bytes({NAME+'/'+name:data for name,data in content.items()}))
    for name,data in [('macOS ZIP',bundle.read_bytes()),('XPI',binary),('source ZIP',content[f'codex-for-zotero-{VERSION}-source.zip'])]:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            assert z.testzip() is None
            if name=='macOS ZIP':
                mode=z.getinfo(NAME+'/检查环境.command').external_attr>>16
                assert mode&0o111,'Missing executable bit'
    result={'version':VERSION,'zip':str(bundle),'bytes':bundle.stat().st_size,'sha256':digest(bundle.read_bytes()),'xpi_sha256':digest(binary),'source_sha256':digest(content[f'codex-for-zotero-{VERSION}-source.zip']),'files':sorted(content),'scope':'macOS adaptation; see bundled verification status for actual coverage'}
    (ROOT/'dist'/(NAME+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(result))
if __name__=='__main__':main()

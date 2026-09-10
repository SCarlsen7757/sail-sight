from pathlib import Path
import json,re,subprocess
refs={}
for p in Path('.github').rglob('*.yml'):
 for ref in re.findall(r'uses: ([\w.-]+/[\w.-]+@[\w.-]+)',p.read_text(encoding='utf-8-sig')):
  repo,tag=ref.split('@')
  if len(tag)==40:continue
  lines=subprocess.check_output(['git','ls-remote',f'https://github.com/{repo}.git',f'refs/tags/{tag}',f'refs/tags/{tag}^{{}}'],text=True).strip().splitlines()
  if not lines:raise RuntimeError(ref)
  refs[ref]=lines[-1].split()[0]
for p in Path('.github').rglob('*.yml'):
 s=p.read_text(encoding='utf-8-sig')
 for ref,sha in refs.items():s=s.replace('uses: '+ref,'uses: '+ref.split('@')[0]+'@'+sha+' # '+ref.split('@')[1])
 p.write_text(s,encoding='utf-8')
Path('docs/security/action-pins.json').write_text(json.dumps(refs,indent=2)+'\n')

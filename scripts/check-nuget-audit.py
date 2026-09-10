import json,sys
report=json.load(open(sys.argv[1],encoding='utf-8-sig'))
findings=[]
for project in report.get('projects',[]):
 for framework in project.get('frameworks',[]):
  for kind in ['topLevelPackages','transitivePackages']:
   for package in framework.get(kind,[]):
    for advisory in package.get('vulnerabilities',[]):
     if advisory['severity'].lower() in ['high','critical']:findings.append((package['id'],advisory))
print(json.dumps(findings,indent=2))
sys.exit(bool(findings))

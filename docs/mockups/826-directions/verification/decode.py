import sys, base64, os
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for line in open(src, encoding='utf-8', errors='replace'):
    if line.startswith('IMG '):
        _, name, data = line.rstrip('\n').split(' ', 2)
        open(os.path.join(out, name), 'wb').write(base64.b64decode(data))
    elif line.startswith('REPORT '):
        open(os.path.join(out, 'report.json'), 'w').write(line[7:])
    else:
        sys.stdout.write(line)

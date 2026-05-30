import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(process.cwd(), 'core', 'test-fixtures', 'widgets');

const files = [
  {
    path: 'valid-static/manifest.json',
    content: JSON.stringify({id:"valid-static",trust:"community",fragment:{file:"fragment/valid-static.html",format:"snippet"}})
  },
  {
    path: 'valid-static/fragment/valid-static.html',
    content: '<div>Valid</div>'
  },
  {
    path: 'invalid-doctype/manifest.json',
    content: JSON.stringify({id:"invalid-doctype",trust:"community",fragment:{file:"fragment/invalid-doctype.html",format:"snippet"}})
  },
  {
    path: 'invalid-doctype/fragment/invalid-doctype.html',
    content: '<!DOCTYPE html><html></html>'
  },
  {
    path: 'invalid-eval/manifest.json',
    content: JSON.stringify({id:"invalid-eval",trust:"verified",fragment:{file:"fragment/invalid-eval.html",format:"snippet"}})
  },
  {
    path: 'invalid-eval/fragment/invalid-eval.html',
    content: '<script>eval("bad")</script>'
  },
  {
    path: 'valid-core-eval/manifest.json',
    content: JSON.stringify({id:"valid-core-eval",trust:"core",fragment:{file:"fragment/valid-core-eval.html",format:"snippet"}})
  },
  {
    path: 'valid-core-eval/fragment/valid-core-eval.html',
    content: '<script>eval("ok")</script>'
  },
  {
    path: 'missing-manifest/fragment/widget.html',
    content: '<div>Missing manifest</div>'
  },
  {
    path: 'missing-fragment/manifest.json',
    content: JSON.stringify({id:"missing-fragment",trust:"community",fragment:{file:"fragment/does-not-exist.html",format:"snippet"}})
  }
];

for (const file of files) {
  const fullPath = join(fixturesDir, file.path);
  const dir = join(fullPath, '..');
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, file.content, 'utf8');
}

console.log('Fixtures created.');

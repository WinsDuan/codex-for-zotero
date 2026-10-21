const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const marked=require('../content/vendor/marked/marked.umd.js');let engine;
const scope={marked:{Marked:class extends marked.Marked{constructor(options){super(options);engine=this;}}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../content/richtext.js'),'utf8'),scope);
test('Chinese bold ending in punctuation renders before following Chinese text',()=>{assert.match(engine.parse('**概括：**两篇论文\n\n**核心方法：**分析'),/<strong>概括：<\/strong>两篇论文/);assert.match(engine.parse('**核心方法：**分析'),/<strong>核心方法：<\/strong>分析/);});
test('literal Markdown in inline code and fenced code remains source',()=>{const html=engine.parse('`**概括：**两篇`\n\n```text\n**方法：**分析\n```');assert.ok(!html.includes('<strong>'));assert.ok(html.includes('**方法：**分析'));});
test('LaTeX slots preserve formulas beside Chinese bold',()=>{const html=engine.parse('**公式：**$x^2$\n\n\\[\\frac{a}{b}\\]\n');assert.ok(html.includes('<strong>公式：</strong>'));assert.ok(html.includes('cz-math-slot'));assert.ok(html.includes('\\frac{a}{b}'));});
test('Markdown renderer keeps HTML and remote image markup inert',()=>{const html=engine.parse('<script>alert(1)</script>\n\n![figure](https://example.invalid/tracker.png)');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));});

"""Convert the approved HTML sources to JSX; financial bindings live in adapters."""
from pathlib import Path
from bs4 import BeautifulSoup, Tag, NavigableString, Comment
import json, re, tinycss2

ROOT = Path('C:/Users/ASUS/.codex/visualizations/2026/10/08/01a11c02-a255-7fa3-a9c5-ea48a4d95d5c')
OUT = Path('src/components/reference')
ASSETS = json.loads(Path('.frontend/reference-assets.json').read_text(encoding='utf8'))
ASSETS = {key: ('/brand/fintrack-logo-inverted.png' if value == '/reference-assets/960b972e9660fdde.png' else value) for key, value in ASSETS.items()}
VOID = {'input', 'img', 'br', 'hr', 'meta', 'link', 'area', 'source', 'wbr', 'col'}
ATTRS = {'stroke-dasharray':'strokeDasharray','stroke-dashoffset':'strokeDashoffset','stroke-opacity':'strokeOpacity','fill-opacity':'fillOpacity','clip-path':'clipPath','class':'className', 'for':'htmlFor', 'tabindex':'tabIndex', 'viewbox':'viewBox', 'stroke-width':'strokeWidth', 'stroke-linecap':'strokeLinecap', 'stroke-linejoin':'strokeLinejoin', 'fill-rule':'fillRule', 'clip-rule':'clipRule', 'maxlength':'maxLength', 'readonly':'readOnly', 'inputmode':'inputMode', 'colspan':'colSpan', 'rowspan':'rowSpan', 'autocomplete':'autoComplete', 'preserveaspectratio':'preserveAspectRatio', 'strokedasharray':'strokeDasharray', 'strokedashoffset':'strokeDashoffset', 'pathlength':'pathLength', 'gradientunits':'gradientUnits', 'gradienttransform':'gradientTransform', 'stop-color':'stopColor', 'stop-opacity':'stopOpacity'}
ROUTES = {'beranda':'/dashboard', 'dompet':'/accounts', 'aktivitas':'/transactions', 'laporan':'/insights', 'laporan-klasik':'/reports', 'pengaturan':'/settings', 'anggaran':'/planning', 'target':'/goals', 'portofolio':'/investments', 'catat':'/transactions?new=1', 'tambah-akun':'/accounts?view=create', 'transfer':'/accounts?view=transfer', 'detail-rekening':'/accounts?view=detail', 'tambah-target':'/goals?view=create', 'detail-target':'/goals?view=detail', 'detail':'/transactions?view=detail', 'edit-transaksi':'/transactions?view=edit', 'edit-anggaran':'/planning?view=edit', 'tambah-investasi':'/investments?view=create', 'detail-aset':'/investments?view=detail', 'edit-aset':'/investments?view=edit', 'transaksi-investasi':'/investments?view=execution'}

def q(value): return json.dumps(value, ensure_ascii=False)
def classes(value):
    value = ' '.join(value) if isinstance(value, list) else value
    value=re.sub(r'(?<![\w-])rounded-(t|b|l|r|tl|tr|bl|br)-lg(?![\w-])',lambda m:'rounded-'+m[1]+'-[32px]',value)
    value=re.sub(r'(?<![\w-])rounded-(t|b|l|r|tl|tr|bl|br)-xl(?![\w-])',lambda m:'rounded-'+m[1]+'-[48px]',value)
    value=value.replace('rounded-DEFAULT','rounded-[16px]')
    value=re.sub(r'(?<![\w-])rounded(?![\w-])','rounded-[16px]',value)
    value=re.sub(r'(?<![\w-])rounded-sm(?![\w-])','rounded-[2px]',value)
    return re.sub(r'(?<![\w-])rounded-lg(?![\w-])', 'rounded-[32px]', re.sub(r'(?<![\w-])rounded-xl(?![\w-])', 'rounded-[48px]', value))
def style(value):
    result = {}
    for declaration in tinycss2.parse_declaration_list(value):
        if declaration.type == 'declaration':
            name = declaration.name if declaration.name.startswith('--') else re.sub(r'-([a-z])',lambda m:m[1].upper(),declaration.name)
            result[name] = tinycss2.serialize(declaration.value).strip()
    return result
def route(value):
    match = re.search(r'fintrack-([\w-]+)-reference\.html', value)
    return ROUTES.get(match[1], '#') if match else value

def render(node, key, index):
    if isinstance(node, Comment): return ''
    if isinstance(node, NavigableString):
        raw = str(node)
        if not raw.strip(): return '{" "}' if raw and '\n' not in raw else ''
        leading = '{" "}' if raw[0].isspace() else ''
        trailing = '{" "}' if raw[-1].isspace() else ''
        text = re.sub(r'\s+', ' ', raw).strip()
        if isinstance(node.parent,Tag) and 'material-symbols-outlined' in node.parent.get('class',[]): return '{text('+q('icon:'+text)+','+q(key+'.'+str(index[id(node.parent)]))+')}'
        return leading+'{text('+q(text)+','+q(key+'.'+str(index[id(node.parent)]))+')}' + trailing
    if not isinstance(node,Tag) or node.name in {'script','style','noscript'}: return ''
    nodekey = key+'.'+str(index[id(node)])
    attributes = ['id="main-content"','tabIndex={-1}'] if node.name=='main' else []
    if node.name=='img' and (node.get('alt') in {'Profile','Profil'} or (key=='pengaturan' and index[id(node)]==26)):
        return '<ProfileAvatar className='+q(classes(node.get('class',[])))+' {...attrs('+q(key+'.'+str(index[id(node)]))+')}/>'
    if node.name=='img' and not node.has_attr('alt'): attributes.append('alt=""')
    if node.name=='span' and 'material-symbols-outlined' in node.get('class',[]) and not node.has_attr('aria-hidden'): attributes.append('aria-hidden="true"')
    if node.name=='nav' and not node.has_attr('aria-label'): attributes.append('aria-label="Navigasi utama"')
    for name,value in node.attrs.items():
        if name.startswith('on') or name in {'selected','data-reference-part'}: continue
        if name=='style': attributes.append('style={'+q(style(value))+'}')
        elif name=='class': attributes.append('className='+q(classes(value)))
        elif name in {'aria-valuenow','aria-valuemin','aria-valuemax','tabindex','maxlength','rows','cols','colspan','rowspan','size'} and str(value).isdigit(): attributes.append(ATTRS.get(name,name)+'={'+str(value)+'}')
        elif name in {'aria-label','placeholder','title','alt'}: attributes.append(name+'={String(text('+q(value)+'))}')
        elif name=='src': attributes.append('src='+q(ASSETS.get(value,value)))
        elif name=='href': attributes.append('href='+q('/planning' if key=='beranda' and value=='#' and node.get_text(strip=True).startswith('Detail') else ROUTES.get(node.get('data-path'),route(value))))
        elif name=='value' and node.name in {'input','textarea','select'}: continue
        elif name in {'checked','disabled','required','readonly','multiple','hidden','open'}: attributes.append(ATTRS.get(name,name)+'={true}')
        else: attributes.append(ATTRS.get(name,name)+'='+q(' '.join(value) if isinstance(value,list) else value))
    if node.name=='button':
        labels={'arrow_back':'Kembali','close':'Tutup','more_vert':'Opsi lainnya','add':'Tambah','remove':'Kurangi','edit':'Ubah','chevron_left':'Periode sebelumnya','chevron_right':'Periode berikutnya','notifications_active':'Perbarui nilai portofolio'}
        label=labels.get(node.get_text(' ',strip=True))
        if label and not node.has_attr('aria-label'): attributes.append('aria-label='+q(label))
        if not node.get('type'): attributes.append('type="button"')
        action = node.get('onclick') or node.get('id') or node.get('aria-label') or re.sub(r'\s+',' ',node.get_text(' ',strip=True))
        if 'selectPreviewLanguage' in action: action += ':' + node.get_text(strip=True)
        attributes.append('onClick={() => action('+q(action)+')}')
    elif node.get('onclick'):
        attributes.append('onClick={() => action('+q(node['onclick'])+')}')
    if node.name in {'input','textarea','select'}:
        fieldname=node.get('id') or node.get('name') or node.get('placeholder') or nodekey
        attributes.append('{...field('+q(fieldname)+','+q(node.get('type','text'))+')}')
    if node.name=='form': attributes.append('onSubmit={submit}')
    attributes.append('{...attrs('+q(nodekey)+')}')
    tag={'lineargradient':'linearGradient','radialgradient':'radialGradient','clippath':'clipPath'}.get(node.name,node.name)
    if node.name=='a' and (route(node.get('href','')).startswith('/') or node.get('data-path') in ROUTES or (key=='beranda' and node.get('href')=='#' and node.get_text(strip=True).startswith('Detail'))): tag='Link'
    if nodekey=='tambah-akun.91': tag='label'
    if nodekey=='pengaturan.27':
        tag='button'
        attributes.append('type="button"')
    start='<'+tag+' '+' '.join(attributes)
    if node.name in VOID: return start+'/>'
    content=''.join(render(child,key,index) for child in node.children)
    if node.name=='select': content='{slot('+q('options:'+(node.get('id') or nodekey))+',()=>('+ '<>'+content+'</>' +'))}'
    result=start+'>'+content+'</'+tag+'>'
    if nodekey=='tambah-akun.96': result='{slot("card-colors",()=>('+result+'))}'
    if node.get('data-reference-part'): result='{slot('+q(node['data-reference-part'])+',()=>('+result+'))}'
    return result

def scope_css(css, prefix):
    output=[]
    for rule in tinycss2.parse_stylesheet(css,skip_whitespace=True,skip_comments=True):
        if rule.type=='qualified-rule':
            if any(token.type=='error' for token in rule.prelude): continue
            selector=tinycss2.serialize(rule.prelude).strip()
            selector=re.sub(r'\.rounded-lg(?![\w-])',lambda _:r'.rounded-\[32px\]',selector)
            selector=re.sub(r'\.rounded-xl(?![\w-])',lambda _:r'.rounded-\[48px\]',selector)
            selector=re.sub(r'\.rounded-DEFAULT(?![\w-])',lambda _:r'.rounded-\[16px\]',selector)
            selector=re.sub(r'\.rounded(?![\w-])',lambda _:r'.rounded-\[16px\]',selector)
            if re.search(r'(?<!\\)\.[\w:-]*\[\d',selector): continue
            selectors=[]
            # Source selectors only contain commas outside attribute/parenthesis groups.
            for item in re.split(r',(?=(?:[^\[\]()]*[\[\(][^\]\)]*[\]\)])*[^\[\]()]*$)',selector):
                item=item.strip()
                item=re.sub(r'^(html|body|:root)(?=$|[ .:])',prefix,item)
                if not item.startswith(prefix):
                    if re.fullmatch(r'\.[\w-]+',item): selectors.append(prefix+item)
                    item=prefix+' '+item
                selectors.append(item)
            output.append(','.join(selectors)+'{'+tinycss2.serialize(rule.content)+'}')
        elif rule.type=='at-rule' and rule.content and rule.lower_at_keyword in {'media','supports','layer'}:
            output.append('@'+rule.at_keyword+' '+tinycss2.serialize(rule.prelude)+'{'+scope_css(tinycss2.serialize(rule.content),prefix)+'}')
    return '\n'.join(output)

layouts={};maps={};css=[];colors=set()
for source in sorted(ROOT.glob('*-reference.html')):
    key=source.stem.removeprefix('fintrack-').removesuffix('-reference')
    variants=[];maps[key]={};body_classes={}
    for theme in ['light','dark']:
        path=source if theme=='light' else ROOT/'fintrack-dark'/source.name
        soup=BeautifulSoup(path.read_text(encoding='utf8'),'html.parser')
        body_classes[theme]=classes(soup.body.get('class',[]))
        config=json.loads(Path('.frontend/reference-configs.json').read_text())[key][theme]
        colors.update(config.get('colors',{}))
        css.append('.ft-reference[data-page='+q(key)+'][data-theme='+q(theme)+']{'+''.join('--ref-'+name+':'+value+';' for name,value in config.get('colors',{}).items())+'}')
        for st in soup.find_all('style'): css.append(scope_css(st.get_text(),'.ft-reference[data-page='+q(key)+'][data-theme='+q(theme)+']'))
        main=soup.find('main');container=main.find(recursive=False)
        nodes=list(soup.body.find_all(True));index={id(n):i for i,n in enumerate(nodes)}
        parts={}
        parts['page']=main
        parts['header']=soup.find('header')
        nav=soup.find('nav')
        if nav: parts['navigation']=nav.parent.parent
        sections=[n for n in container.find_all(recursive=False) if n.name not in {'script','style'}]
        for i,n in enumerate(sections): n['data-reference-part']='section-'+str(i);parts['section-'+str(i)]=n
        # Reusable collection primitives are extracted from the source rather than redesigned.
        if key=='dompet':
            card=soup.select_one('.wallet-preview-card')
            if card: parts['wallet-card']=card
            rows=sections[-1].find_all(recursive=False)
            if rows:parts['account-row']=rows[0]
        if key=='target':
            row=sections[3].find(recursive=False)
            if row: parts['goal-card']=row
        if key=='anggaran':
            section=sections[3]
            rows=section.find_all(recursive=False)
            if len(rows)>1:parts['budget-card']=rows[1].find(recursive=False)
        if key=='beranda':
            budget_rows=sections[4].find_all(recursive=False)[1]
            parts['budget-row']=budget_rows.find(recursive=False)
            budget_rows['data-reference-part']='budget-rows'
            tx_group=sections[6].find_all(recursive=False)[1]
            parts['transaction-row']=tx_group.find_all(recursive=False)[1]
            parts['transaction-income']=sections[6].find_all(recursive=False)[2].find_all(recursive=False)[1]
            streak=sections[3].select_one('.grid-cols-7')
            if streak: streak['data-reference-part']='streak-days'
        if key=='dompet':
            carousel=sections[1].find_all(recursive=False)[1]
            carousel['data-reference-part']='wallet-cards'
        if key=='aktivitas':
            group=sections[4].find(recursive=False)
            if group:
                children=group.find_all(recursive=False)
                if len(children)>1: parts['transaction-row']=children[1].find(recursive=False)
            sections[1].find_all(recursive=False)[2]['data-reference-part']='calendar-days'
        if key=='laporan':
            soup.find(id='report-bar-chart')['data-reference-part']='report-bars'
            soup.find(id='report-donut-chart')['data-reference-part']='report-donut'
            pattern=sections[5].find_all(recursive=False)[1]
            pattern['data-reference-part']='pattern-observations'
            category_list=sections[4].find_all(recursive=False)[3]
            parts['category-row']=category_list.find(recursive=False)
            category_list['data-reference-part']='category-rows'
        if key=='pilih-kategori':
            listing=soup.find(id='expense-list')
            parts['picker-category-row']=listing.find_all(recursive=False)[1]
            soup.find(id='category-scroll-container')['data-reference-part']='picker-categories'
        if key=='pilih-rekening':
            listing=soup.find(id='accounts-list')
            parts['picker-account-row']=listing.find(recursive=False)
            listing['data-reference-part']='picker-accounts'
        if key=='hapus-aset':
            nodes[38]['data-reference-part']='asset-delete-description'
        if key=='detail-aset':
            sections[3].find_all(recursive=False)[2]['data-reference-part']='asset-history-chart'
            listing=sections[5].find_all(recursive=False)[1]
            parts['asset-trade']=listing.find(recursive=False)
            listing['data-reference-part']='asset-trades'
        if key=='portofolio':
            listing=sections[4]
            if listing.find(recursive=False): parts['asset-card']=listing.find(recursive=False)
        maps[key][theme]=[{'key':key+'.'+str(index[id(n)]),'tag':n.name,'id':n.get('id'),'class':' '.join(n.get('class',[])),'text':n.get_text(' ',strip=True)[:180]} for n in nodes]
        rendered=[]
        for name,node in parts.items():
            node.attrs.pop('data-reference-part',None)
            rendered.append(q(name)+': (api: ReferenceApi) => { const {text,field,action,attrs,submit,slot}=api; return ('+render(node,key,index)+'); }')
            if name.startswith('section-'): node['data-reference-part']=name
        variants.append(q(theme)+':{'+',\n'.join(rendered)+'}')
    image_lint = '/* eslint-disable @next/next/no-img-element */\n' if any('<img ' in variant for variant in variants) else ''
    OUT.joinpath(key+'.tsx').write_text(image_lint+'/* Generated JSX from the approved HTML. Native images preserve source sizing. */\n/* eslint-disable @typescript-eslint/no-unused-vars */\nimport Link from "next/link";\nimport {ProfileAvatar} from "@/components/ProfileAvatar";\nimport type {ReferenceApi,ReferenceTemplateInput} from "./runtime";\nexport const templates={'+',\n'.join(variants)+'};\nexport default function SourceTemplate({theme,part,api}:ReferenceTemplateInput){const render=(templates[theme] as Record<string,(api:ReferenceApi)=>React.ReactNode>)[part];return render?render(api):null;}\n',encoding='utf8')
    layouts[key]={'bodyClass':body_classes,'mainClass':classes(main.get('class',[])),'containerClass':classes(container.get('class',[])),'sectionCount':len(sections)}

Path('.frontend/reference-node-map.json').write_text(json.dumps(maps,ensure_ascii=False,indent=2),encoding='utf8')
OUT.joinpath('layouts.json').write_text(json.dumps(layouts,indent=2),encoding='utf8')
OUT.joinpath('templates.ts').write_text('import dynamic from "next/dynamic";\nexport const referenceTemplates={'+','.join(q(key)+':dynamic(()=>import("./'+key+'"))' for key in layouts)+'};\n',encoding='utf8')

tokens='@theme inline{'+''.join('--color-'+name+':var(--ref-'+name+');' for name in sorted(colors))+'--shadow-sm:0 1px 2px 0 rgb(0,0,0,.05);--shadow-md:0 4px 6px -1px rgb(0,0,0,.1),0 2px 4px -2px rgb(0,0,0,.1);--shadow-lg:0 10px 15px -3px rgb(0,0,0,.1),0 4px 6px -4px rgb(0,0,0,.1);--shadow-xl:0 20px 25px -5px rgb(0,0,0,.1),0 8px 10px -6px rgb(0,0,0,.1);--shadow-xs:none;--spacing-margin:1.25rem;--spacing-space-lg:1.25rem;--spacing-space-md:.75rem;--spacing-space-xl:1.75rem;--spacing-gutter:1rem;--spacing-space-sm:.5rem;--spacing-space-xs:.25rem;'+''.join('--font-'+name+':var(--font-'+('jakarta' if name.startswith(('headline','currency')) else 'manrope')+');' for name in ['label-sm','label-md','label-lg','body-sm','body-md','body-lg','headline-sm','headline-md','headline-lg','headline-xl','currency-md','currency-display'])+'}'
sizes={'label-sm':(11,14,'.04em',600),'label-md':(12,16,'.02em',600),'label-lg':(14,20,'normal',600),'body-sm':(12,16,'normal',400),'body-md':(14,20,'normal',500),'body-lg':(16,24,'normal',500),'headline-sm':(18,24,'normal',600),'headline-md':(20,28,'-.01em',600),'headline-lg':(24,32,'-.015em',700),'headline-xl':(32,40,'-.02em',700),'currency-md':(16,22,'-.01em',700),'currency-display':(28,36,'-.02em',800)}
for name,(size,height,spacing,weight) in sizes.items():tokens+='\n@utility text-'+name+'{font-size:'+str(size)+'px;line-height:'+str(height)+'px;letter-spacing:'+spacing+';font-weight:'+str(weight)+';}'
base='''
@font-face{font-family:"Material Symbols Outlined";font-style:normal;font-weight:100 700;font-display:block;src:url("/reference-assets/material-symbols.woff2") format("woff2")}
@layer components{.ft-reference .material-symbols-outlined{font-family:"Material Symbols Outlined";font-weight:normal;font-style:normal;font-size:24px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-feature-settings:"liga";-webkit-font-smoothing:antialiased}}
.ft-reference{--color-background:var(--ref-background);--color-foreground:var(--ref-on-surface);--color-primary:var(--ref-primary);--color-secondary:var(--ref-secondary);--primary:var(--ref-primary);--secondary:var(--ref-secondary);font-feature-settings:normal;font-family:var(--font-manrope),sans-serif;font-size:16px;line-height:1.5;letter-spacing:normal;min-height:max(884px,100dvh);display:flex;flex-direction:column;background:var(--ref-surface);color:var(--ref-on-surface)}
.ft-reference .pt-safe{padding-top:env(safe-area-inset-top,0px)}
.ft-reference .pb-safe{padding-bottom:env(safe-area-inset-bottom,0px)}
.ft-reference :is(main,header,nav)::-webkit-scrollbar,.ft-reference .no-scrollbar::-webkit-scrollbar{display:none}
'''
base+='body:has(.ft-reference)::-webkit-scrollbar{display:none}'
base+='@media print{.ft-reference>header,.ft-reference>div:has(nav),.ft-reference>main{display:none!important}.ft-reference{min-height:0;background:#fff;color:#000}}'
css.append(scope_css((ROOT/'fintrack-dark/dark-theme.css').read_text(encoding='utf8'),'.ft-reference[data-theme="dark"]'))
gradient_css = ''.join('.ft-reference .bg-gradient-to-'+key+'{--tw-gradient-position:'+direction+'}' for key,direction in {'r':'to right','l':'to left','t':'to top','b':'to bottom','br':'to right bottom','bl':'to left bottom','tr':'to right top','tl':'to left top'}.items())
category_css = '.ft-reference[data-theme] [data-category-label]{color:var(--category-label-color)!important}.ft-reference [data-category-icon]{background:var(--category-bg-light)!important;color:var(--category-fg-light)!important}.ft-reference [data-category-icon] .material-symbols-outlined{color:var(--category-fg-light)!important}.ft-reference[data-theme="dark"] [data-category-icon]{background:var(--category-bg-dark)!important;color:var(--category-fg-dark)!important}.ft-reference[data-theme="dark"] [data-category-icon] .material-symbols-outlined{color:var(--category-fg-dark)!important}'
OUT.joinpath('reference.css').write_text(tokens+'\n'+base+'\n'+'\n'.join(css)+'\n'+category_css+'\n'+gradient_css,encoding='utf8')
print('Converted',len(layouts),'screens and both themes to JSX/Tailwind.')

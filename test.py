import json
import re

def test_matching():
    with open('gold.json', 'r', encoding='utf-16') as f:
        data = json.load(f)
        
    def normalize(s):
        s = s.lower()
        s = s.replace('ı', 'i').replace('i̇', 'i')
        s = s.replace('ö', 'o').replace('ü', 'u')
        s = s.replace('ş', 's').replace('ğ', 'g').replace('ç', 'c')
        return s

    name = 'Çeyrek Altın'
    
    found = None
    for item in data['result']:
        gname = item['name']
        match1 = gname == name
        match2 = normalize(gname) == normalize(name)
        match3 = gname.replace(' ', '').lower() == name.replace(' ', '').lower()
        match4 = gname.lower() in name.lower() or name.lower() in gname.lower()
        
        if match1 or match2 or match3 or match4:
            found = item
            print("MATCH FOUND:", gname)
            break
            
    if not found:
        print("NO MATCH FOUND")
        
test_matching()

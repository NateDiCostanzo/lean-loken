#!/usr/bin/env python3
"""Assemble app/src + app/js into the single published file lean/lean-out-12.html."""
import glob,os
D=os.path.dirname(os.path.abspath(__file__))
r=lambda p:open(os.path.join(D,p)).read().rstrip('\n')
js='\n'.join(open(f).read().rstrip('\n') for f in sorted(glob.glob(os.path.join(D,'js','*.js'))))
css='\n'.join(open(f).read().rstrip('\n') for f in sorted(glob.glob(os.path.join(D,'src','*.css'))))
out=r('src/head.html')+'\n<style>\n'+css+'\n</style>\n'+r('src/shell.html')+'\n<script>\n'+js+'\n</script>\n'
import sys
dst=sys.argv[1] if len(sys.argv)>1 else os.path.join(D,'..','lean','lean-out-12.html')
open(dst,'w').write(out)
print('built',len(out),'bytes')

from pathlib import Path
import base64, copy, io, json, struct
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent

def prepare(filename, output, variable, trees=False):
    raw = Path(r'C:\Users\varsh\Downloads', filename).read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+size])
    binary = raw[28+size:]
    dtype = {5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}
    widths = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
    def accessor(i):
        a = doc['accessors'][i]; view = doc['bufferViews'][a['bufferView']]
        dt = np.dtype(dtype[a['componentType']]); width = widths[a['type']]
        return np.ndarray((a['count'],width),dtype=dt,buffer=binary,
            offset=view.get('byteOffset',0)+a.get('byteOffset',0),
            strides=(view.get('byteStride',width*dt.itemsize),dt.itemsize)).copy()
    def transform(node):
        if 'matrix' in node: return np.array(node['matrix']).reshape(4,4).T
        x,y,z,w = node.get('rotation',[0,0,0,1]); m = np.eye(4)
        m[:3,:3] = np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
            [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
            [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]) @ np.diag(node.get('scale',[1,1,1]))
        m[:3,3] = node.get('translation',[0,0,0]); return m
    variants = {}
    def visit(i, parent, variant):
        node = doc['nodes'][i]; matrix = parent @ transform(node)
        if trees and node.get('name','').lower().startswith('tree') and 'mesh' not in node:
            variant = node['name']
        if 'mesh' in node:
            for p in doc['meshes'][node['mesh']]['primitives']:
                positions = accessor(p['attributes']['POSITION'])
                positions = (np.c_[positions,np.ones(len(positions))] @ matrix.T)[:,:3]
                normals = accessor(p['attributes']['NORMAL']) @ np.linalg.inv(matrix[:3,:3])
                normals /= np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
                uv = accessor(p['attributes']['TEXCOORD_0'])
                indices = accessor(p['indices']).ravel()
                variants.setdefault(variant,{}).setdefault(p.get('material',0),[]).append((positions,normals,uv,indices))
        for child in node.get('children',[]): visit(child,matrix,variant)
    for i in doc['scenes'][doc.get('scene',0)]['nodes']: visit(i,np.eye(4),'Model')
    out = {key:copy.deepcopy(doc[key]) for key in ['asset','materials','textures','samplers'] if key in doc}
    out.update(scene=0,scenes=[dict(nodes=[])],nodes=[],meshes=[],bufferViews=[],accessors=[],images=[])
    blob = bytearray()
    def add(array):
        while len(blob)%4: blob.append(0)
        view = len(out['bufferViews'])
        out['bufferViews'].append(dict(buffer=0,byteOffset=len(blob),byteLength=array.nbytes))
        blob.extend(array.tobytes())
        item = dict(bufferView=view,componentType=5125 if array.dtype==np.dtype('<u4') else 5126,
                    count=len(array),type='SCALAR' if array.ndim==1 else 'VEC'+str(array.shape[1]))
        if array.ndim==2 and array.shape[1]==3: item.update(min=array.min(0).tolist(),max=array.max(0).tolist())
        out['accessors'].append(item); return len(out['accessors'])-1
    for name, materials in variants.items():
        primitives = []
        for material, parts in materials.items():
            offsets = np.cumsum([0]+[len(part[0]) for part in parts[:-1]])
            positions = np.concatenate([p[0] for p in parts]).astype('<f4')
            normals = np.concatenate([p[1] for p in parts]).astype('<f4')
            uv = np.concatenate([p[2] for p in parts]).astype('<f4')
            indices = np.concatenate([p[3]+offset for p,offset in zip(parts,offsets)]).astype('<u4')
            primitives.append(dict(attributes=dict(POSITION=add(positions),NORMAL=add(normals),TEXCOORD_0=add(uv)),indices=add(indices),material=material))
        out['scenes'][0]['nodes'].append(len(out['nodes']))
        out['nodes'].append(dict(name=name,mesh=len(out['meshes'])))
        out['meshes'].append(dict(name=name,primitives=primitives))
    for image in doc['images']:
        view = doc['bufferViews'][image['bufferView']]
        texture = Image.open(io.BytesIO(binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]))
        texture.thumbnail((512,512),Image.Resampling.LANCZOS)
        stream = io.BytesIO(); texture.save(stream,format='PNG')
        data = stream.getvalue()
        while len(blob)%4: blob.append(0)
        out['images'].append(dict(bufferView=len(out['bufferViews']),mimeType='image/png'))
        out['bufferViews'].append(dict(buffer=0,byteOffset=len(blob),byteLength=len(data))); blob.extend(data)
    out['buffers'] = [dict(byteLength=len(blob))]
    payload = json.dumps(out,separators=(',',':')).encode(); payload += b' '*(-len(payload)%4)
    blob.extend(b'\0'*(-len(blob)%4))
    glb = struct.pack('<III',0x46546c67,2,28+len(payload)+len(blob))+struct.pack('<II',len(payload),0x4e4f534a)+payload+struct.pack('<II',len(blob),0x004e4942)+blob
    (root/(output+'.glb')).write_bytes(glb)
    (root/(output+'_data.js')).write_text('window.'+variable+' = "'+base64.b64encode(glb).decode()+'";\n')
    (root/(output+'_credit.json')).write_text(json.dumps(dict(**doc['asset']['extras'],transformation='Unchanged geometry, merged by material within each variant; textures resized to 512px for efficient repeated rendering.'),indent=2))
    print(output, list(variants), len(glb), 'bytes')

prepare('oak_trees.glb','downloaded_trees','AVATAR3_TREES_B64',True)
prepare('bench__park_-_14mb.glb','downloaded_bench','AVATAR3_BENCH_B64')

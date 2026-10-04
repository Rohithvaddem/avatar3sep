from pathlib import Path
import numpy as np
import json, struct, base64
root=Path(__file__).resolve().parent
source=Path(r'C:\Users\varsh\Downloads\modern_lego_house.glb')
raw=source.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+length]); offset=20+length
binlength=struct.unpack_from('<I',raw,offset)[0]; binary=raw[offset+8:offset+8+binlength]
types={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}
sizes={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def accessor(i):
    a=doc['accessors'][i]; v=doc['bufferViews'][a['bufferView']]; dtype=np.dtype(types[a['componentType']]); n=sizes[a['type']]
    return np.ndarray((a['count'],n),dtype=dtype,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',n*dtype.itemsize),dtype.itemsize)).copy()
def matrix(node):
    if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
    x,y,z,w=node.get('rotation',[0,0,0,1]); m=np.eye(4)
    m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(node.get('scale',[1,1,1]))
    m[:3,3]=node.get('translation',[0,0,0]);return m
positions=[];indices=[];colors=[]; original_normals=[]
def visit(i,parent):
    node=doc['nodes'][i]; m=parent@matrix(node)
    if 'mesh' in node:
        for p in doc['meshes'][node['mesh']]['primitives']:
            v=accessor(p['attributes']['POSITION']); v=(np.c_[v,np.ones(len(v))]@m.T)[:,:3]
            idx=accessor(p['indices']).ravel() if 'indices'in p else np.arange(len(v))
            color=doc['materials'][p.get('material',0)].get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])[:3]
            normals=accessor(p['attributes']['NORMAL']) @ np.linalg.inv(m[:3,:3])
            normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
            original_normals.append(normals)
            indices.append(idx+sum(len(x)for x in positions)); positions.append(v);colors.append(np.tile(color,(len(v),1)))
    for child in node.get('children',[]):visit(child,m)
for i in doc['scenes'][doc.get('scene',0)]['nodes']:visit(i,np.eye(4))
v=np.concatenate(positions); c=np.concatenate(colors); tris=np.concatenate(indices).reshape(-1,3)
origin=v.min(0); extent=v.max(0)-origin
for resolution in [96]:
    cell=extent.max()/resolution
    key=np.c_[np.round((v-origin)/cell).astype(int),np.round(c*255).astype(int)]
    _,first,inverse=np.unique(key,axis=0,return_index=True,return_inverse=True)
    mapped=inverse[tris]; valid=(mapped[:,0]!=mapped[:,1])&(mapped[:,1]!=mapped[:,2])&(mapped[:,0]!=mapped[:,2])
    t=np.unique(mapped[valid],axis=0)
    if len(t)<10000:break
p=v[first].astype('<f4');col=c[first].astype('<f4'); normals=np.zeros_like(p)
face=np.cross(p[t[:,1]]-p[t[:,0]],p[t[:,2]]-p[t[:,0]])
for k in range(3):np.add.at(normals,t[:,k],face)
normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
arrays=[p,normals,col,t.astype('<u4').ravel()]; blob=b'';views=[];access=[]
for i,a in enumerate(arrays):
    b=a.tobytes();views.append(dict(buffer=0,byteOffset=len(blob),byteLength=len(b)));blob+=b
    ac=dict(bufferView=i,componentType=5125 if i==3 else 5126,count=len(a),type='SCALAR' if i==3 else 'VEC3')
    if i==0:ac.update(min=p.min(0).tolist(),max=p.max(0).tolist())
    access.append(ac)
out=dict(asset=doc['asset'],scene=0,scenes=[dict(nodes=[0])],nodes=[dict(mesh=0)],meshes=[dict(primitives=[dict(attributes=dict(POSITION=0,NORMAL=1,COLOR_0=2),indices=3,material=0)])],materials=[dict(name='Original house colors',pbrMetallicRoughness=dict(baseColorFactor=[1,1,1,1],roughnessFactor=.8,metallicFactor=0),doubleSided=True)],buffers=[dict(byteLength=len(blob))],bufferViews=views,accessors=access)
js=json.dumps(out,separators=(',',':')).encode();js+=b' '*((-len(js))%4);blob+=b'\0'*((-len(blob))%4)
glb=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(blob),0x004e4942)+blob
(root/'downloaded_house_optimized.glb').write_bytes(glb)
(root/'downloaded_house_data.js').write_text('window.AVATAR3_DOWNLOADED_HOUSE_B64 = "'+base64.b64encode(glb).decode()+'";')
(root/'downloaded_house_credit.json').write_text(json.dumps(dict(**doc['asset']['extras'],originalTriangles=len(tris),optimizedTriangles=len(t),optimization='Vertex clustering, merged mesh, baked original material colors'),indent=2))
print(f'House optimized: {len(tris)} -> {len(t)} triangles; {len(glb)} bytes. Bounds: {extent}')
# Keep exact source vertices and normals for close inspection; only merge draw calls.
arrays=[v.astype('<f4'),np.concatenate(original_normals).astype('<f4'),c.astype('<f4'),tris.astype('<u4').ravel()]
blob=b''; views=[]; access=[]
for i,a in enumerate(arrays):
    b=a.tobytes(); views.append(dict(buffer=0,byteOffset=len(blob),byteLength=len(b))); blob+=b
    ac=dict(bufferView=i,componentType=5125 if i==3 else 5126,count=len(a),type='SCALAR' if i==3 else 'VEC3')
    if i==0:ac.update(min=a.min(0).tolist(),max=a.max(0).tolist())
    access.append(ac)
out['bufferViews']=views;out['accessors']=access;out['buffers']=[dict(byteLength=len(blob))]
js=json.dumps(out,separators=(',',':')).encode();js+=b' '*((-len(js))%4);blob+=b'\0'*((-len(blob))%4)
full=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(blob))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(blob),0x004e4942)+blob
(root/'downloaded_house_full.glb').write_bytes(full)
with (root/'downloaded_house_data.js').open('a') as f:
    f.write('\nwindow.AVATAR3_DOWNLOADED_HOUSE_FULL_B64 = "'+base64.b64encode(full).decode()+'";')
print('Full-detail house saved with unchanged source vertices and sharp normals.')

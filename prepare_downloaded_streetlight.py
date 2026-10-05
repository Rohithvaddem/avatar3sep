from pathlib import Path
import base64, copy, json, struct
import numpy as np

root = Path(__file__).resolve().parent
source = Path(r'C:\Users\varsh\Downloads\arc_lamp_-_victorian_street_lamp.glb')
raw = source.read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + length])
binary = raw[28 + length:]
types = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}
sizes = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def read_accessor(index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    dtype = np.dtype(types[a['componentType']])
    n = sizes[a['type']]
    return np.ndarray((a['count'], n), dtype=dtype, buffer=binary,
        offset=view.get('byteOffset', 0) + a.get('byteOffset', 0),
        strides=(view.get('byteStride', n * dtype.itemsize), dtype.itemsize)).copy()

far = copy.deepcopy(doc)
far['bufferViews'], far['accessors'] = [], []
blob = bytearray()
triangle_count = 0
for mesh in far['meshes']:
    for primitive in mesh['primitives']:
        vertices = read_accessor(primitive['attributes']['POSITION'])
        triangles = read_accessor(primitive['indices']).reshape(-1, 3)
        cell = max(np.ptp(vertices, axis=0).max() / 48, 1e-8)
        _, first, inverse = np.unique(np.round(vertices / cell).astype(int), axis=0, return_index=True, return_inverse=True)
        mapped = inverse[triangles]
        valid = (mapped[:, 0] != mapped[:, 1]) & (mapped[:, 1] != mapped[:, 2]) & (mapped[:, 0] != mapped[:, 2])
        triangles = np.unique(mapped[valid], axis=0)
        positions = vertices[first].astype('<f4')
        normals = np.zeros_like(positions)
        face = np.cross(positions[triangles[:, 1]] - positions[triangles[:, 0]], positions[triangles[:, 2]] - positions[triangles[:, 0]])
        for k in range(3): np.add.at(normals, triangles[:, k], face)
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-9)
        attributes = {}
        for name, array in [('POSITION', positions), ('NORMAL', normals), ('indices', triangles.astype('<u4').ravel())]:
            index = len(far['accessors'])
            far['bufferViews'].append(dict(buffer=0, byteOffset=len(blob), byteLength=array.nbytes))
            blob.extend(array.tobytes())
            accessor = dict(bufferView=index, componentType=5125 if name == 'indices' else 5126,
                            count=len(array), type='SCALAR' if name == 'indices' else 'VEC3')
            if name == 'POSITION': accessor.update(min=positions.min(0).tolist(), max=positions.max(0).tolist())
            far['accessors'].append(accessor)
            if name == 'indices': primitive['indices'] = index
            else: attributes[name] = index
        primitive['attributes'] = attributes
        triangle_count += len(triangles)
far['buffers'] = [dict(byteLength=len(blob))]
payload = json.dumps(far, separators=(',', ':')).encode()
payload += b' ' * (-len(payload) % 4)
blob.extend(b'\0' * (-len(blob) % 4))
far_raw = struct.pack('<III', 0x46546c67, 2, 28 + len(payload) + len(blob)) + struct.pack('<II', len(payload), 0x4e4f534a) + payload + struct.pack('<II', len(blob), 0x004e4942) + blob
(root / 'downloaded_streetlight.glb').write_bytes(raw)
(root / 'downloaded_streetlight_far.glb').write_bytes(far_raw)
(root / 'downloaded_streetlight_data.js').write_text('window.AVATAR3_STREETLIGHT_B64 = "' + base64.b64encode(raw).decode() + '";\nwindow.AVATAR3_STREETLIGHT_FAR_B64 = "' + base64.b64encode(far_raw).decode() + '";\n')
(root / 'downloaded_streetlight_credit.json').write_text(json.dumps(dict(**doc['asset']['extras'], distantTriangles=triangle_count, transformation='Original model retained nearby; vertex clustering for distant views; repeated geometry rendered with instancing.'), indent=2))
print('Street lamp distant triangles:', triangle_count)

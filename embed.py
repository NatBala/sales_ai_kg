"""One local question -> vector compatible with the existing MiniLM index."""
import sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'work/embedding-deps'))
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer
text=json.load(sys.stdin)['text'][:3000]
model=ROOT/'work/embedding-model';opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.inter_op_num_threads=1
session=ort.InferenceSession(str(model/'model.onnx'),sess_options=opts,providers=['CPUExecutionProvider'])
tok=Tokenizer.from_file(str(model/'tokenizer.json'));tok.enable_truncation(max_length=256);tok.enable_padding(pad_id=0,pad_token='[PAD]')
enc=tok.encode_batch([text]);data={'input_ids':np.asarray([x.ids for x in enc],dtype=np.int64),'attention_mask':np.asarray([x.attention_mask for x in enc],dtype=np.int64),'token_type_ids':np.asarray([x.type_ids for x in enc],dtype=np.int64)}
h=session.run(None,{x.name:data[x.name] for x in session.get_inputs()})[0];mask=data['attention_mask'][...,None].astype(np.float32)
v=(h*mask).sum(axis=1)/np.maximum(mask.sum(axis=1),1e-9);v/=np.maximum(np.linalg.norm(v,axis=1,keepdims=True),1e-9)
assert v.shape==(1,384) and np.isfinite(v).all()
print(json.dumps(v[0].tolist()))

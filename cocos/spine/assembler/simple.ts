/*
 Copyright (c) 2020-2023 Xiamen Yaji Software Co., Ltd.

 https://www.cocos.com/

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 of the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

import { UIRenderable } from '../../2d';
import { IAssembler, IAssemblerManager } from '../../2d/renderer/base';

import { Batcher2D } from '../../2d/renderer/batcher-2d';
import { StaticVBAccessor } from '../../2d/renderer/static-vb-accessor';
import { vfmtPosUvColor4B, vfmtPosUvTwoColor4B, getAttributeStride } from '../../2d/renderer/vertex-format';
import { Skeleton, SpineMaterialType } from '../skeleton';
import { BlendFactor } from '../../gfx';
import { legacyCC } from '../../core/global-exports';
import { RenderData } from '../../2d/renderer/render-data';
import { director } from '../../game';
import spine from '../lib/spine-core.js';

let _accessor: StaticVBAccessor = null!;
let _tintAccessor: StaticVBAccessor = null!;

let _premultipliedAlpha = false;
let _useTint = false;

const _byteStrideOneColor = getAttributeStride(vfmtPosUvColor4B);
const _byteStrideTwoColor = getAttributeStride(vfmtPosUvTwoColor4B);

function _getSlotMaterial (blendMode: number, comp: Skeleton) {
    let src: BlendFactor;
    let dst: BlendFactor;
    switch (blendMode) {
    case 1:
        src =  _premultipliedAlpha ? BlendFactor.ONE :  BlendFactor.SRC_ALPHA;
        dst = BlendFactor.ONE;
        break;
    case 2:
        src = BlendFactor.DST_COLOR;
        dst = BlendFactor.ONE_MINUS_SRC_ALPHA;
        break;
    case 3:
        src = BlendFactor.ONE;
        dst = BlendFactor.ONE_MINUS_SRC_COLOR;
        break;
    case 0:
    default:
        src = _premultipliedAlpha ? BlendFactor.ONE : BlendFactor.SRC_ALPHA;
        dst = BlendFactor.ONE_MINUS_SRC_ALPHA;
        break;
    }
    return comp.getMaterialForBlendAndTint(src, dst, _useTint ? SpineMaterialType.TWO_COLORED : SpineMaterialType.COLORED_TEXTURED);
}

export const simple: IAssembler = {
    fillBuffers (render: UIRenderable, batcher: Batcher2D) {

    },
    updateColor (render: UIRenderable) {

    },
    vCount: 32767,
    ensureAccessor (useTint: boolean) {
        let accessor = useTint ? _tintAccessor : _accessor;
        if (!accessor) {
            const device = director.root!.device;
            const batcher = director.root!.batcher2D;
            const attributes = useTint ? vfmtPosUvTwoColor4B : vfmtPosUvColor4B;
            if (useTint) {
                accessor = _tintAccessor = new StaticVBAccessor(device, attributes, this.vCount);
                // Register to batcher so that batcher can upload buffers after batching process
                batcher.registerBufferAccessor(Number.parseInt('SPINETINT', 36), _tintAccessor);
            } else {
                accessor = _accessor = new StaticVBAccessor(device, attributes, this.vCount);
                // Register to batcher so that batcher can upload buffers after batching process
                batcher.registerBufferAccessor(Number.parseInt('SPINE', 36), _accessor);
            }
        }
        return accessor;
    },

    createData (comp: Skeleton) {
        let rd = comp.renderData;
        if (!rd) {
            const useTint = comp.useTint || comp.isAnimationCached();
            const accessor = this.ensureAccessor(useTint) as StaticVBAccessor;
            rd = RenderData.add(useTint ? vfmtPosUvTwoColor4B : vfmtPosUvColor4B, accessor);
        }
        return rd;
    },

    updateRenderData (comp: Skeleton, batcher: Batcher2D) {
        const skeleton = comp._skeleton;
        if (skeleton) {
            updateComponentRenderData(comp, batcher);
        }
    },
};

function updateComponentRenderData (comp: Skeleton, batcher: Batcher2D) {
    _useTint = comp.useTint || comp.isAnimationCached();
    if (comp.isAnimationCached()) {
        cacheTraverse(comp);
    } else {
        realTimeTraverse(comp);
    }
    const rd = comp.renderData!;
    const accessor = _useTint ? _tintAccessor : _accessor;
    accessor.getMeshBuffer(rd.chunk.bufferId).setDirty();
}

function realTimeTraverse (comp: Skeleton) {
    _premultipliedAlpha = comp.premultipliedAlpha;

    const floatStride = (_useTint ?  _byteStrideTwoColor : _byteStrideOneColor) / Float32Array.BYTES_PER_ELEMENT;

    comp.drawList.reset();
    const model = comp.updateRenderData();
    if (!model) return;

    const vc = model.vCount;
    const ic = model.iCount;
    const rd = comp.renderData!;
    rd.resize(vc, ic);
    rd.indices = new Uint16Array(ic);
    const vbuf = rd.chunk.vb;
    const vUint8Buf = new Uint8Array(vbuf.buffer, vbuf.byteOffset, Float32Array.BYTES_PER_ELEMENT * vbuf.length);

    const vPtr = model.vPtr;
    const vLength = vc * Float32Array.BYTES_PER_ELEMENT * floatStride;
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    const vData = spine.wasmUtil.HEAPU8.subarray(vPtr, vPtr + vLength);
    vUint8Buf.set(vData);

    const iPtr = model.iPtr;
    const ibuf = rd.indices;
    const iLength = Uint16Array.BYTES_PER_ELEMENT * ic;
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    const iData = spine.wasmUtil.HEAPU8.subarray(iPtr, iPtr + iLength);
    const iUint8Buf = new Uint8Array(ibuf.buffer);
    iUint8Buf.set(iData);
    const chunkOffset = rd.chunk.vertexOffset;
    for (let i = 0; i < ic; i++) {
        rd.indices[i] += chunkOffset;
    }

    const meshes = model.getMeshes();
    const count = meshes.size();
    let indexOffset = 0;
    let indexCount = 0;
    for (let i = 0; i < count; i++) {
        const mesh = meshes.get(i);
        const material = _getSlotMaterial(mesh.blendMode, comp);
        indexCount = mesh.iCount;
        comp.requestDrawData(material, indexOffset, indexCount);
        indexOffset += indexCount;
    }
}

function cacheTraverse (comp: Skeleton) {
    _premultipliedAlpha = comp.premultipliedAlpha;

    comp.drawList.reset();
    const model = comp.updateRenderData();

    const vc = model.vCount;
    const ic = model.iCount;
    const rd = comp.renderData!;
    rd.resize(vc, ic);
    rd.indices = new Uint16Array(ic);
    const vbuf = rd.chunk.vb;
    const vUint8Buf = new Uint8Array(vbuf.buffer, vbuf.byteOffset, Float32Array.BYTES_PER_ELEMENT * vbuf.length);
    vUint8Buf.set(model.vData);

    const iUint16Buf = rd.indices;
    iUint16Buf.set(model.iData);
    const chunkOffset = rd.chunk.vertexOffset;
    for (let i = 0; i < ic; i++) {
        rd.indices[i] += chunkOffset;
    }

    const meshes = model.meshes;
    const count = meshes.length;
    let indexOffset = 0;
    let indexCount = 0;
    for (let i = 0; i < count; i++) {
        const mesh = meshes[i];
        const material = _getSlotMaterial(mesh.blendMode, comp);
        indexCount = mesh.iCount;
        comp.requestDrawData(material, indexOffset, indexCount);
        indexOffset += indexCount;
    }
}

legacyCC.internal.SpineAssembler = simple;

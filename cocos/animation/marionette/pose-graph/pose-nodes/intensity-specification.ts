import { ccenum } from '../../../../core';
import { ccclass, editable, serializable, type, visible } from '../../../../core/data/decorators';
import { AuxiliaryCurveHandle } from '../../../core/animation-handle';
import { Pose } from '../../../core/pose';
import { CLASS_NAME_PREFIX_ANIM } from '../../../define';
import { AnimationGraphBindingContext } from '../../animation-graph-context';

enum IntensityType {
    VALUE,

    AUXILIARY_CURVE,
}
ccenum(IntensityType);

@ccclass(`${CLASS_NAME_PREFIX_ANIM}IntensitySpecification`)
export class IntensitySpecification {
    @type(IntensityType)
    @serializable
    @editable
    public type = IntensityType.VALUE;

    @serializable
    @editable
    @visible(function visible (this: IntensitySpecification) { return this.type === IntensityType.VALUE; })
    public value = 1.0;

    @serializable
    @editable
    @visible(function visible (this: IntensitySpecification) { return this.type === IntensityType.AUXILIARY_CURVE; })
    public auxiliaryCurveName = '';

    public bind (context: AnimationGraphBindingContext) {
        if (this.type === IntensityType.AUXILIARY_CURVE && this.auxiliaryCurveName) {
            const handle = context.bindAuxiliaryCurve(this.auxiliaryCurveName);
            this._handle = handle;
        }
    }

    public evaluate (pose: Readonly<Pose>) {
        if (this.type === IntensityType.AUXILIARY_CURVE && this._handle) {
            const value = pose.auxiliaryCurves[this._handle.index];
            return value;
        }
        return this.value;
    }

    private _handle: AuxiliaryCurveHandle | undefined = undefined;
}

import { EDITOR } from 'internal:constants';
import { ccclass, serializable } from '../../../core/data/decorators';
import { CLASS_NAME_PREFIX_ANIM } from '../../define';
import { PoseNode } from './pose-node';
import { PoseGraphType } from './foundation/type-system';
import { PoseGraphNode } from './foundation/pose-graph-node';
import { globalPoseGraphNodeInputManager } from './foundation/authoring/input-authoring';
import { poseGraphNodeAppearance } from './decorator/node';

@ccclass(`${CLASS_NAME_PREFIX_ANIM}PoseGraphOutputNode`)
@poseGraphNodeAppearance({
    themeColor: '#CD3A58',
    inline: true,
})
export class PoseGraphOutputNode extends PoseGraphNode {
    // Don't use @input since it requires the owner class being subclass of `PoseNode`.
    @serializable
    pose: PoseNode | null = null;
}

globalPoseGraphNodeInputManager.setPropertyNodeInputRecord(PoseGraphOutputNode, 'pose', {
    type: PoseGraphType.POSE,
});

/**
 * ADR-0028 tint mask 组件：挂载 mask 纹理 + base 色，自动应用 shader 合成。
 *
 * 用法（Cocos Creator 编辑器）：
 * 1. 创建 Sprite 节点
 * 2. 导入 mask PNG（RGB=d, A=l）
 * 3. 右键 tint-mask.effect → 创建材质，拖入本组件 tintMaterial 槽
 * 4. 挂载本组件
 * 5. 设置 maskTexture（拖入 mask PNG）
 * 6. 设置 baseColor（选颜色）
 * 7. 运行看效果
 *
 * 合成公式：out = base * d + (1 - base) * l
 */
import { _decorator, Component, Sprite, Texture2D, Color, Material, Vec4 } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('TintMaskSprite')
@executeInEditMode
export class TintMaskSprite extends Component {
    @property(Texture2D)
    maskTexture: Texture2D | null = null;

    @property(Color)
    baseColor: Color = new Color(255, 255, 255, 255);

    /** 需要用户在编辑器里手动绑定：tint-mask.effect → 创建材质 → 拖入这里 */
    @property(Material)
    tintMaterial: Material | null = null;

    start() {
        this._applyMaterial();
    }

    onEnable() {
        this._applyMaterial();
    }

    private _applyMaterial() {
        if (!this.tintMaterial) {
            console.warn('[TintMaskSprite] 请先在编辑器中创建材质（tint-mask.effect → 创建材质），然后拖入 tintMaterial 属性槽');
            return;
        }

        const sprite = this.node.getComponent(Sprite);
        if (!sprite) {
            console.warn('[TintMaskSprite] 节点需要 Sprite 组件');
            return;
        }

        sprite.customMaterial = this.tintMaterial;
        this._updateMaterialProps(true);
    }

    /**
     * ⚠ 探针加固（2026-09-29）：executeInEditMode 下 update 每帧跑，无变化检测会把
     *  setProperty 放大成每帧告警风暴。另：**手改 .mtl/.scene 后编辑器内存里的材质实例
     *  不会热刷新 effect layout** ⇒ `illegal property name: maskTexture`（getHandle 查的
     *  是旧实例属性表，library 编译产物里属性其实存在）。处置：编辑器里把 Tint Material
     *  槽**清空重拖一次**（重建材质实例），或重启编辑器。
     */
    private _lastKey: string = '';

    private _updateMaterialProps(force = false) {
        const sprite = this.node.getComponent(Sprite);
        if (!sprite || !this.tintMaterial) return;
        // 脏检查：mask/色未变不重 set（削告警风暴 + 零 GC 压力）。
        const key = (this.maskTexture ? this.maskTexture.uuid : 'null')
            + '|' + this.baseColor.toHEX();
        if (!force && key === this._lastKey) return;
        this._lastKey = key;
        // ⚠ 必须 set 到**材质实例**（getMaterialInstance），不能 set 共享材质资产：
        //  编辑态对共享资产的 uniform 改动不一定触发渲染数据刷新（实测 2026-09-29）。
        // ⚠ baseColor 必须**Vec4 + 0-1 值域**：引擎 FLOAT4 writer 是 Vec4.toArray（读 x/y/z/w），
        //  传 Color（r/g/b/a）字段读不到 ⇒ uniform 静默写坏（实测 2026-09-29 baseColor 不生效）；
        //  且 shader uniform 是 0-1 浮点，Color 的 0-255 值域也要归一。
        const inst = sprite.getMaterialInstance(0);
        inst.setProperty('maskTexture', this.maskTexture);
        inst.setProperty('baseColor', new Vec4(
            this.baseColor.r / 255,
            this.baseColor.g / 255,
            this.baseColor.b / 255,
            this.baseColor.a / 255,
        ));
    }

    update() {
        // 编辑器模式下实时同步属性到材质（有脏检查，仅变化帧真正 set）。
        this._updateMaterialProps();
    }
}

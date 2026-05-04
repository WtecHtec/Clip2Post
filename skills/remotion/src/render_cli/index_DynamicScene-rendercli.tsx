
import { registerRoot, Composition, AbsoluteFill, Audio } from 'remotion';
import DynamicComponent from '../render_cli/DynamicScene-rendercli';

const WrapperComponent = (props: any) => {
    return (
        <AbsoluteFill style={{ overflow: 'hidden', width: 1920, height: 1080 }}>
            {props.audioUrl && <Audio src={props.audioUrl} />}
            {props.bgm && <Audio src={props.bgm.startsWith('http') ? props.bgm : `http://localhost:8000/bgm/${props.bgm}`} volume={0.15} />}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
                <DynamicComponent {...props} />
            </div>
        </AbsoluteFill>
    );
};

export const RemotionRoot = () => {
    return (
        <Composition
            id="DynamicScene-rendercli"
            component={WrapperComponent}
            durationInFrames={1322}
            fps={30}
            width={1920}
            height={1080}
        />
    );
};

registerRoot(RemotionRoot);

import { Composition } from 'remotion';
import { MyAnimation as BarChartAnimation } from '../skills/remotion/rules/assets/charts-bar-chart';
import { MyAnimation as TypewriterAnimation } from '../skills/remotion/rules/assets/text-animations-typewriter';
import { MyAnimation as WordHighlightAnimation } from '../skills/remotion/rules/assets/text-animations-word-highlight';
import { MyScene, MySceneSchema } from './MyScene';

export const RemotionRoot = () => {
	return (
		<>
			<Composition
				id="BarChart"
				component={BarChartAnimation}
				durationInFrames={120}
				fps={30}
				width={1280}
				height={720}
			/>
			<Composition
				id="Typewriter"
				component={TypewriterAnimation}
				durationInFrames={180}
				fps={30}
				width={1920}
				height={1080}
				defaultProps={{
					fullText: 'From prompt to motion graphics. This is Remotion.',
					pauseAfter: 'From prompt to motion graphics.',
				}}
			/>
			<Composition
				id="WordHighlight"
				component={WordHighlightAnimation}
				durationInFrames={90}
				fps={30}
				width={1080}
				height={1080}
			/>
			<Composition
				id="MyScene"
				component={MyScene}
				durationInFrames={150}
				fps={30}
				width={1080}
				height={1920}
				schema={MySceneSchema}
				defaultProps={{
					captions: [
						{ text: '欢迎来到', startMs: 0, endMs: 1000 },
						{ text: '自动化视频生成', startMs: 1100, endMs: 3000 },
						{ text: 'Remotion 演示', startMs: 3100, endMs: 5000 },
					],
					backgroundColor: '#1a1a1a',
					textColor: '#ffd700',
				}}
			/>
		</>
	);
};

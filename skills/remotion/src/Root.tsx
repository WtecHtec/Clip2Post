import { Composition } from 'remotion';
import { MyAnimation as BarChartAnimation } from '../skills/remotion/rules/assets/charts-bar-chart';
import { MyAnimation as TypewriterAnimation } from '../skills/remotion/rules/assets/text-animations-typewriter';
import { MyAnimation as WordHighlightAnimation } from '../skills/remotion/rules/assets/text-animations-word-highlight';
import { MyScene, MySceneSchema } from './MyScene';
import { ImageScene, ImageSceneSchema } from './ImageScene';
import { NewsScene, NewsSceneSchema } from './NewsScene';
import { AITemplate } from './demo/AITemplate';

export const RemotionRoot = () => {
	return (
		<>
			<Composition
				id="AITemplate"
				component={AITemplate}
				durationInFrames={225}
				fps={30}
				width={1080}
				height={1920}
				defaultProps={{
					author: '@your_handle',
					topic: 'AI工具速递',
					title: '语音AI终于听懂你情绪了',
					titleHighlight: '听懂',
					bodyText: '副语言识别 · 百万人格组合 · 中英双语',
					progressPercent: 45,
					outroTagline: 'AI · 工具 · 变现',
				}}
			/>
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
			<Composition
				id="ImageScene"
				component={ImageScene}
				durationInFrames={150}
				fps={30}
				width={1080}
				height={1920}
				schema={ImageSceneSchema}
				defaultProps={{
					captions: [
						{ text: '这是一个图片下方', startMs: 0, endMs: 2000 },
						{ text: '显示字幕的全新模式', startMs: 2100, endMs: 5000 },
					],
					imageUrl: 'tasks/dummy_image.jpg',
				}}
			/>
			<Composition
				id="NewsScene"
				component={NewsScene}
				durationInFrames={300}
				fps={30}
				width={1080}
				height={1920}
				schema={NewsSceneSchema}
				defaultProps={{
					mainText: '这是测试的一段非常长的正文内容，会从屏幕下方滚动到上方。',
					imageUrl: 'tasks/dummy_image.jpg',
					coverTitle: '突发新闻',
					endingTitle: '谢谢观看',
				}}
			/>
		</>
	);
};

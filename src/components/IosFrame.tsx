import type { CSSProperties, ReactNode } from 'react';
// Adapted from huashu-design/assets/ios_frame.jsx. Device chrome is unchanged.
const iosFrameStyles: Record<string, CSSProperties> = {
  wrapper: { display:'inline-block', padding:12, background:'#000', borderRadius:60, boxShadow:'0 0 0 2px #1f2937, 0 20px 60px rgba(0,0,0,0.3)', position:'relative' },
  screen: { position:'relative', borderRadius:48, overflow:'hidden', background:'#fff' },
  statusBar: { position:'absolute', top:0, left:0, right:0, height:54, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', fontSize:16, fontWeight:600, fontFamily:'-apple-system, "SF Pro Text", sans-serif', zIndex:20, pointerEvents:'none' },
  dynamicIsland: { position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', width:124, height:36, background:'#000', borderRadius:999, zIndex:30 },
  statusIcons: { display:'flex', alignItems:'center', gap:6 },
  signalIcon: { display:'flex', alignItems:'flex-end', gap:2, height:12 },
  signalBar: { width:3, background:'currentColor', borderRadius:1 },
  batteryIcon: { width:26, height:12, border:'1.5px solid currentColor', borderRadius:3, padding:1, position:'relative', opacity:.8 },
  batteryCap: { position:'absolute', top:3, right:-3, width:2, height:6, background:'currentColor', borderRadius:'0 1px 1px 0' },
  content: { position:'absolute', top:54, left:0, right:0, bottom:34, overflow:'auto' },
  homeIndicator: { position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', width:140, height:5, background:'rgba(0,0,0,0.3)', borderRadius:999, zIndex:10 },
  homeIndicatorDark: { background:'rgba(255,255,255,0.5)' },
};
interface IosFrameProps { children: ReactNode; darkMode?: boolean; screenBackground?: string }
export default function IosFrame({ children, darkMode = false, screenBackground }: IosFrameProps) {
  const textColor = darkMode ? '#fff' : '#000';
  return <div style={iosFrameStyles.wrapper} className="official-ios-frame"><div style={{ ...iosFrameStyles.screen, width:393, height:852, background:screenBackground ?? (darkMode ? '#000' : '#fff') }}>
    <div style={{ ...iosFrameStyles.statusBar, color:textColor }}><span>9:41</span><div style={iosFrameStyles.statusIcons}><div style={iosFrameStyles.signalIcon}>{[4,6,9,11].map(height => <div key={height} style={{ ...iosFrameStyles.signalBar, height }}/>)}</div><svg width="16" height="12" viewBox="0 0 16 12" fill="none" style={{ color:textColor }}><path d="M8 11.5a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/><path d="M3 7.5a7 7 0 0110 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round"/><path d="M1 4.5a11 11 0 0114 0" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7"/></svg><div style={iosFrameStyles.batteryIcon}><div style={{ width:'85%', height:'100%', background:'currentColor', borderRadius:1, opacity:.9 }}/><div style={iosFrameStyles.batteryCap}/></div></div></div>
    <div style={iosFrameStyles.dynamicIsland}/><div style={iosFrameStyles.content}>{children}</div><div style={{ ...iosFrameStyles.homeIndicator, ...(darkMode ? iosFrameStyles.homeIndicatorDark : {}) }}/>
  </div></div>;
}

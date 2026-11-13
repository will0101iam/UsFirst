import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Share, PlusSquare, Smartphone, ShieldCheck, Users, ScanLine, Cloud, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
interface AboutDialogProps { open: boolean; onClose(): void }
export default function AboutDialog({ open, onClose }: AboutDialogProps) {
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="request-dialog"><DialogHeader className="text-left"><span className="eyebrow">两个人，一个小约定</span><DialogTitle className="text-2xl">一起花</DialogTitle><DialogDescription>花钱前，先和对方说一声。</DialogDescription></DialogHeader>
    <div className="about-section"><h3><Smartphone size={19}/>放到 iPhone 主屏幕</h3><ol className="install-steps"><li><span>1</span><p>正式部署到 HTTPS 地址后，用 <strong>Safari</strong> 打开。</p></li><li><span>2</span><p>点击<Share size={15} className="inline mx-1"/><strong>分享</strong>，选择<PlusSquare size={15} className="inline mx-1"/><strong>添加到主屏幕</strong>。</p></li><li><span>3</span><p>若出现“作为网页 App 打开”，打开它，再点“添加”。之后从主屏幕图标进入。</p></li></ol><p className="text-xs leading-6 text-muted-foreground mt-3">当前是电脑本地预览，并非手机可用的正式线上地址；主屏幕独立显示配置已准备好。</p></div>
    <div className="about-section"><h3><ShieldCheck size={19}/>这一版能做什么</h3><p>先拍照或上传图片，再核对申请信息；也能手动填写。支持切换双方演示身份、通过或拒绝审批、获批后标记已购买。</p><p className="mt-3 text-xs text-muted-foreground">数据只存在当前浏览器，照片在本地处理。示例申请带有“示例”标记。身份切换不是登录，也不代表任何真实权限。</p></div>
    <div className="about-section"><h3><Cloud size={19}/>正式使用前还需要</h3><ul className="reserved-list"><li><Users size={17}/>两个固定账号的服务端登录与跨手机同步</li><li><ShieldCheck size={17}/>后端审批权限与私有照片存储</li><li><ScanLine size={17}/>你提供的 LLM 接口，识别后手动确认再提交</li><li><Cloud size={17}/>Cloudflare 后端适配和正式部署</li></ul></div>
    <p className="text-xs leading-6 text-muted-foreground">这是双方自愿使用的消费约定，不会连接购物平台、拦截支付或代替你们下单。</p><Button className="w-full h-12" onClick={onClose}>开始体验<ArrowRight size={17}/></Button>
  </DialogContent></Dialog>;
}

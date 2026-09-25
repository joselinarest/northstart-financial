import {expect,test} from '@playwright/test';
for(const [width,height] of [[360,800],[390,844],[430,932],[768,1024],[1024,900],[1440,1000]])test(`recommendation parity ${width}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/workspace/decision-verification');
 const dismiss=page.getByRole('button',{name:'Dismiss install suggestion'});if(await dismiss.isVisible())await dismiss.click();
 const cards=page.getByTestId('recommendation-card');await expect(cards).toHaveCount(5);
 for(const card of await cards.all()){await expect(card).toHaveAttribute('open','');await expect(card.getByRole('heading',{name:'Trade Size and Risk Plan'})).toBeVisible();await expect(card.getByText('Shares / contracts')).toBeVisible();}
 const first=cards.first();expect(await first.evaluate(el=>parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThanOrEqual(8);expect(await first.locator(':scope > summary').evaluate(el=>getComputedStyle(el).display)).toBe('grid');await first.locator(':scope > summary').click();await expect(first).not.toHaveAttribute('open','');await expect(cards.nth(1)).toHaveAttribute('open','');await first.locator(':scope > summary').press('Enter');await expect(first).toHaveAttribute('open','');
 await first.getByText('Research and calculation details',{exact:true}).click();await expect(first.getByText('Deterministic sizing calculation')).toBeVisible();
 const bounds=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+1);
 await page.screenshot({path:`test-results/tailwind/recommendation-${width}.png`,fullPage:true});
});

test('shared dialog preserves Escape, focus trap and mobile fit',async({page})=>{
 await page.setViewportSize({width:360,height:800});await page.goto('/workspace/decision-verification');await page.getByRole('button',{name:'Install',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();const box=await dialog.boundingBox();expect(box!.width).toBeLessThanOrEqual(360);expect(box!.height).toBeLessThanOrEqual(800);await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
});

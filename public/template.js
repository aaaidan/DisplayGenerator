export default `
<div>
<p><input type="radio" v-bind:value="command.id" v-on:change="radioChanged" name="selectedCmd" v-model="selectedCmd" />
<span v-if="command.op === 'writePixel'">
writePixel: x = <input v-model="command.x" size="4"> y = <input v-model="command.y" size="4"> 
color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'drawLine'">
drawLine: x0 = <input v-model="command.x0" size="4"> y0 = <input v-model="command.y0" size="4"> 
x1 = <input v-model="command.x1" size="4"> y1 = <input v-model="command.y1" size="4">
color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'drawRect'">
drawRect: x = <input v-model="command.x" size="4"> y = <input v-model="command.y" size="4"> 
w = <input v-model="command.w" size="4"> h = <input v-model="command.h" size="4">
color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'fillRect'">
fillRect: x = <input v-model="command.x" size="4"> y = <input v-model="command.y" size="4"> 
w = <input v-model="command.w" size="4"> h = <input v-model="command.h" size="4">
color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'drawRoundRect'">
drawRoundRect: x = <input v-model="command.x" size="4"> y = <input v-model="command.y" size="4"> 
w = <input v-model="command.w" size="4"> h = <input v-model="command.h" size="4">
r = <input v-model="command.r" size="4"> color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'fillRoundRect'">
fillRoundRect: x = <input v-model="command.x" size="4"> y = <input v-model="command.y" size="4"> 
w = <input v-model="command.w" size="4"> h = <input v-model="command.h" size="4">
r = <input v-model="command.r" size="4"> color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'drawCircle'">
drawCircle: x = <input v-model="command.x" size="4"> y = <input v-model="command.y" size="4"> 
r = <input v-model="command.r" size="4"> 
color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'fillCircle'">
fillCircle: x = <input v-model="command.x" size="4"> y = <input v-model="command.y" size="4"> 
r = <input v-model="command.r" size="4"> 
color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'drawTriangle'">
drawTriangle: x0 = <input v-model="command.x0" size="4"> y0 = <input v-model="command.y0" size="4"> 
x1 = <input v-model="command.x1" size="4"> y1 = <input v-model="command.y1" size="4">
x2 = <input v-model="command.x2" size="4"> y2 = <input v-model="command.y2" size="4">
color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'fillTriangle'">
fillTriangle: x0 = <input v-model="command.x0" size="4"> y0 = <input v-model="command.y0" size="4"> 
x1 = <input v-model="command.x1" size="4"> y1 = <input v-model="command.y1" size="4">
x2 = <input v-model="command.x2" size="4"> y2 = <input v-model="command.y2" size="4">
color = <input v-model="command.color" size="4">
</span>
<span v-if="command.op === 'setCursor'">
setCursor: x = <input v-model="command.x" size="4"> y = <input v-model="command.y" size="4"> 
</span>
<span v-if="command.op === 'setFont'">
setFont: 
<select v-model="command.font">
<option v-for="font in fonts" v-bind:value="font">
{{ font }}
</option>
</select>
</span>
<span v-if="command.op === 'setTextColor'">
setTextColor: <input type="checkbox" v-model="command.invert"/>Inverted Color (only works for default font)
</span>
<span v-if="command.op === 'setTextSize'">
setTextSize: size = <input v-model="command.size" size="4">
</span>
<span v-if="command.op === 'setTextWrap'">
setTextWrap: w = <input v-model="command.w" size="4"> (0 = no wrap, 1 = wrap. Default is no wrap.)
</span>
<span v-if="command.op === 'print'">
print: <input v-model="command.text" size="20">
</span>
<span v-if="command.op === 'println'">
println: <input v-model="command.text" size="20">
</span>
<span v-if="command.op === 'printCentered'">
printCentered: <input v-model="command.text" size="20"> width = {{command.width}}
</span>
<span v-if="command.op === 'drawIcon'">
drawIcon: x = <input v-model="command.x" size="4"> y = <input v-model="command.y" size="4"> 
color = <input v-model="command.color" size="4">
width = {{command.width}} height= {{command.height}} <br/> 
bitmap = <input v-model="command.bitmap" size="50">
</span>
</p>
</div>
`
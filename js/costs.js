const COST_GROUPS = { structure:'Structure & envelope', finishes:'Finishes & openings', furniture:'Furniture & fixtures', services:'Services & preliminaries', outdoors:'Site & outdoor spaces', garage:'Detached garage' };
const COST_RATES = {
  foundation:['Foundation & ground slab','m²',105,60,'structure',false,'Concrete, reinforcement, excavation and installation; no soil investigation.'],
  floorSlab:['Suspended floor slab','m²',100,55,'structure',false,'Concrete, reinforcement and formwork.'],
  column:['Structural column','m',65,35,'structure',false,'Concept column allowance; sizing requires structural design.'],
  beam:['Perimeter beam','m',50,30,'structure',false,'Concept structural frame allowance.'],
  plasterWall:['Rendered masonry wall','m²',62,42,'structure',true,'Net face area, excluding openings; masonry, render and paint included.'],
  concreteWall:['Concrete-finish wall','m²',85,48,'structure',true,'Net face area, excluding openings; wall and finish included.'],
  timberWall:['Timber-clad wall','m²',108,48,'structure',true,'Net face area; supporting wall, insulation and timber cladding included.'],
  stoneWall:['Stone-clad wall','m²',145,65,'structure',true,'Net face area; supporting wall and stone finish included.'],
  metalWall:['Metal-clad wall','m²',110,48,'structure',true,'Net face area; supporting wall and metal finish included.'],
  partition:['Interior partition','m²',36,28,'finishes',true,'One face measured, both faces finished; doorway excluded.'],
  window:['Glazed window assembly','m²',235,65,'finishes',true,'Glazing, frames, seals and installation included.'],
  door:['Interior door assembly','each',340,110,'finishes',true,'Leaf, frame, handle and hinges; shown open for the walkthrough.'],
  entryDoor:['Entrance door assembly','each',780,180,'finishes',true,'Leaf, frame, lockset and installation; shown open.'],
  timberFloor:['Timber floor finish','m²',48,22,'finishes',true,'Finish surface and underlay; structural slab is a separate line.'],
  stoneFloor:['Stone floor finish','m²',70,30,'finishes',true,'Finish surface, adhesive and installation.'],
  roofDeck:['Roof deck & ceiling','m²',85,45,'structure',false,'Structural deck and internal ceiling; roof covering is separate.'],
  flatRoof:['Flat roof covering','m²',52,26,'structure',false,'Membrane, insulation and gravel protection.'],
  pitchedRoof:['Pitched roof covering','m²',76,34,'structure',false,'Sloping surface area; metal roof and secondary supports.'],
  parapet:['Parapet','m',45,28,'structure',true,'Wall upstand, coping and finish.'],
  canopy:['Entrance / roof canopy','m²',130,65,'structure',true,'Canopy structure and finish.'],
  railing:['Glass balustrade','m',180,65,'finishes',true,'Glass panels, fixings and installation.'],
  fin:['Facade fin','each',95,35,'finishes',true,'Decorative metal fin and fixings.'],
  step:['Entrance step','m²',85,40,'structure',false,'Concrete step and finish.'],
  sofa:['Upholstered sofa','each',1450,55,'furniture',true,'Sofa and cushions; delivery / placement included.'],
  armchair:['Armchair','each',520,25,'furniture',true,'Complete chair; delivery / placement included.'],
  loungeChair:['Outdoor lounge chair','each',430,25,'furniture',true,'Complete chair, including cushions.'],
  coffeeTable:['Coffee table & accessories','each',320,20,'furniture',true,'Table, displayed books and small accessories included as one set.'],
  mediaWall:['Media wall, console & TV','each',2400,220,'furniture',true,'Paneling, console, display and soundbar included as one assembly.'],
  diningTable:['Dining table & centerpiece','each',780,35,'furniture',true,'Table and displayed centerpiece; chairs are separate lines.'],
  chair:['Dining chair','each',165,12,'furniture',true,'One complete chair.'],
  bed:['Bed, mattress & bedding','each',1250,65,'furniture',true,'Bed frame, mattress, pillows, bedding and headboard included.'],
  nightstand:['Nightstand & table lamp','each',290,20,'furniture',true,'Bedside cabinet and displayed lamp included.'],
  wardrobe:['Wardrobe','each',1100,150,'furniture',true,'Complete storage unit and installation.'],
  floorLamp:['Floor lamp','each',185,15,'furniture',true,'Lamp and bulb; electrical wiring is in services.'],
  dresser:['Dresser','each',570,35,'furniture',true,'Complete dresser and displayed accessories.'],
  kitchenRun:['Kitchen cabinetry & appliances','each',4100,650,'furniture',true,'Modeled cabinet run, countertop, sink, tap, hob, oven and hood; refrigerator separate.'],
  island:['Kitchen island','each',1300,180,'furniture',true,'Cabinet and countertop; stools are separate.'],
  barStool:['Bar stool','each',135,12,'furniture',true,'One complete stool.'],
  fridge:['Refrigerator','each',900,55,'furniture',true,'Appliance, delivery and connection.'],
  vanity:['Vanity & basin','each',650,180,'furniture',true,'Cabinet, basin, tap and mirror.'],
  tub:['Bathtub','each',950,240,'furniture',true,'Bath, fittings and installation.'],
  shower:['Shower enclosure','each',850,260,'furniture',true,'Tray, screen and shower fittings.'],
  toilet:['Toilet','each',260,130,'furniture',true,'Pan, cistern and connection.'],
  rack:['Storage rack','each',850,110,'furniture',true,'Rack and pallets; displayed cartons are illustrative, stock is excluded.'],
  desk:['Desk','each',480,30,'furniture',true,'Desk and modeled desktop accessories.'],
  officeChair:['Task chair','each',240,15,'furniture',true,'One complete adjustable chair.'],
  bookshelf:['Bookshelf & styling','each',520,45,'furniture',true,'Shelving and displayed books / accessories included.'],
  plant:['Indoor plant & pot','each',75,10,'furniture',true,'Plant and planter.'],
  pendant:['Pendant light','each',95,45,'furniture',true,'Light fitting and installation; circuit wiring is separate.'],
  wallLight:['Wall light','each',85,40,'furniture',true,'Light fitting and installation.'],
  siteBase:['Site preparation & ground cover','m²',3,5,'outdoors',false,'Whole-plot grading and basic ground-cover allowance, including preparation beneath buildings.'],
  edging:['Plot edging','m',15,12,'outdoors',false,'Concrete border and installation.'],
  paving:['Paved surface','m²',35,22,'outdoors',false,'Paving, bedding and installation.'],
  planter:['Raised planter','each',170,65,'outdoors',false,'Concrete planter and growing medium.'],
  tree:['Planted tree','each',220,90,'outdoors',false,'Tree, planting and establishment allowance.'],
  pool:['Swimming pool shell & finish','m²',640,260,'outdoors',false,'Water surface area; excavation, shell, waterproofing and tile finish included.'],
  poolPlant:['Pool filtration & equipment','lot',2100,800,'outdoors',false,'Pump, filtration and pool connections; not separately modeled.'],
  deck:['Timber decking','m²',85,40,'finishes',true,'Deck boards, supports and installation.'],
  garageDoor:['Sectional garage door','each',1550,350,'garage',false,'Door, motor, tracks and installation. No vehicle included.'],
  electrical:['Electrical rough-in','m²',30,24,'services',false,'Cables, outlets and distribution allowance; decorative light fittings separate.'],
  plumbing:['Plumbing & drainage rough-in','m²',18,18,'services',false,'Pipes and drainage allowance; sanitary fixtures separate.'],
  ventilation:['Ventilation / cooling allowance','m²',32,16,'services',false,'Early-stage equipment and installation allowance, not an engineered system.'],
  preliminaries:['Site setup & contractor preliminaries','m²',12,26,'services',false,'Temporary works, supervision and contractor overhead; trade installation is in each line.'],
};
const costMoney = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
const costQuantity = quantity => new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(quantity);
function createCostLedger(spec) {
  const lines=[];
  function add(code,quantity=1,{room=null,scope='building',label='',modeled=true}={}) {
    const [name,unit,material,labor,group,finish,note]=COST_RATES[code];
    const factor=finish?[0,.8,.9,1,1.2,1.45][spec.lux]:1;
    const qty=Math.round(quantity*1000)/1000;
    const materialRateCents=Math.round(material*factor*100),laborRateCents=Math.round(labor*100);
    const materialCents=Math.round(qty*materialRateCents),laborCents=Math.round(qty*laborRateCents);
    const line={id:`item-${lines.length+1}`,code,name:label||name,unit,quantity:qty,materialRateCents,laborRateCents,materialCents,laborCents,totalCents:materialCents+laborCents,group:scope==='garage'?'garage':scope==='outdoors'?'outdoors':group,roomId:room?.id||'',location:room?`${room.floor===0?'Ground floor':'Level '+(room.floor+1)} · ${room.label}`:scope==='garage'?'Detached garage':scope==='outdoors'?'Outdoor spaces':'Whole building',note,modeled};
    lines.push(line);return line;
  }
  function finish() {
    const groups=Object.fromEntries(Object.keys(COST_GROUPS).map(key=>[key,0]));
    for(const line of lines)groups[line.group]+=line.totalCents;
    const materialCents=lines.reduce((sum,line)=>sum+line.materialCents,0);
    const laborCents=lines.reduce((sum,line)=>sum+line.laborCents,0);
    const subtotalCents=materialCents+laborCents,contingencyCents=Math.round(subtotalCents*.12);
    return {lines,groups,materialCents,laborCents,subtotalCents,contingencyCents,totalCents:subtotalCents+contingencyCents};
  }
  return {add,finish};
}

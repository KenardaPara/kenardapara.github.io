class Fiyatlar {    
    constructor(isim, veri, agirlik, color){
        function initMap(vs){
            var m = new Map();
            vs.forEach(function(kv){
                m.set(dateToStr(kv[0]), kv[1]);
            });
            return m; 
        }
        this.isim = isim;
        this.veri = veri;
        this.veriler = initMap(veri);
        this.agirlik = agirlik;
        this.color = color;
    }

    

}

const stdDateParser = function(str){return new Date(str);};

const monthlyParser = function(str){return new Date(str+"-01");};

function printPromise(name){
    return function(x){
        console.log(`promise ${name}  `, x);
        return x;
    };
}

class GraphData {
    constructor(urlParams){
        var desiredStartDate = 0; 
        
        if(urlParams.has("start")){
            desiredStartDate = new Date(urlParams.get("start"));
            urlParams.delete('start');
        } else {
            desiredStartDate = new Date(2000, 1,1);
        }

        var TLMiktar = 100;
        if(urlParams.has("miktar")){
            TLMiktar = parseFloat(urlParams.get("miktar"));
            urlParams.delete('miktar');
        }

        var DevletKatkisiFonu = "GHI";
        if(urlParams.has("devlet")){
            DevletKatkisiFonu = urlParams.get("devlet");
            urlParams.delete('devlet');
        }

        var inflationAdj = false;
        if(urlParams.has("inflationAdj")){
            inflationAdj = urlParams.get("inflationAdj") == 'on';
            urlParams.delete('inflationAdj');
//            $("#inflationAdj").attr('value', inflationAdj);
        }

        
        const katkiTL = loadTLData(DevletKatkisiFonu, 1);
        const katkiEURO = loadEuroData(DevletKatkisiFonu, 1);
        const katkiUSD = loadUSDData(DevletKatkisiFonu, 1);
        
        const besDataTLAll = loadBesData(urlParams,loadTLData);
        const besDataEuroAll = loadBesData(urlParams,loadEuroData);
        const besDataUSDAll = loadBesData(urlParams,loadUSDData);        
        var promisesToBeAligned = besDataTLAll.slice();
        promisesToBeAligned.push(USDDaily);
        promisesToBeAligned.push(EURODaily);
        promisesToBeAligned.push(AltinDaily);
        const date = Promise.all(promisesToBeAligned).then(function(v){return alignedDate(v,desiredStartDate).date;}).then(printPromise("aligned date"));
        this.dateAligment = Promise.all(promisesToBeAligned).then(function(v){return alignedDate(v,desiredStartDate);}).then(printPromise("aligned reason"));
        this.date = date;
        const aligner = function(veriler){
            return date.then(function (d){ return alignDates(veriler, d);});
        };

        const TLmiktarP = Promise.resolve(TLMiktar);
        
        const buyer = function(amount, isim, exchanger, inflationAdjusterP, color){
            return function(fiyatlars){
                return amount.then(function(a){
                    return inflationAdjusterP.then(function (i){
                        return exchanger.then(function (ex){
                            return buyFiyatlar(fiyatlars, a, isim, ex, i, color)})})})}};


        const faizci = function(amount, isim, exchanger, inflationAdjusterP, color){
            return function(fiyatlars){
                return amount.then(function(a){
                    return inflationAdjusterP.then(function (i){
                        return exchanger.then(function (ex){
                            return investFaiz(fiyatlars, a, isim, ex, i, color)})})})}};

        

        const fixedInlfation = Promise.resolve(sifirEnflasyon);
        const TUFEInf = Promise.resolve((x,y,z,m) => enflasyoncu(x,y,z,infData));
        const inflation = inflationAdj ? TUFEInf : fixedInlfation ;
        
        const euroExchnager = EURODaily.then(x => function(m, d){return m*x.veriler.get(d);});
        const dolarExchanger = USDDaily.then(x => function(m, d){return m*x.veriler.get(d);});
        const fixedExchanger = Promise.resolve ((x,y) => x); 

        const buyerExchange = function(amount, isim, color){
            return function(fiyatlars){
                return amount.then(function(a){return buyExchange(fiyatlars, a, isim, color);});
            };
        };

        
        const dolarMiktar = date.then(function(d){
            return USDDaily.then(function(f){return Math.floor(TLMiktar/f.veriler.get(dateToStr(d)));});
        }).then(printPromise("Dolar Miktar "));

        const euroMiktar = date.then(function(d){
            return EURODaily.then(function(f){

                const valueAtDate = f.veriler.get(dateToStr(d));
                const amount = TLMiktar / valueAtDate;
                return Math.floor(amount);
            });
        }).then(printPromise("Euro Miktar "));

        const altinMiktar = date.then(function(d){
            return AltinDaily.then(function(f){

                const valueAtDate = f.veriler.get(dateToStr(d));
                const amount = TLMiktar / valueAtDate;
                return Math.floor(amount);
            });
        }).then(printPromise("Altin Miktar "));


        function converter(lookUp){
            return function(fiyatlars){
                return lookUp.then(function(v){ return [convertToTL(fiyatlars[0], v.veriler, fiyatlars[0].isim), fiyatlars[1]];});
            };
        }


        function addDevlet(katkiFonu, miktarF){
            return function(fiyatlars){
                return katkiFonu.then(function (katki){
                    return miktarF.then(function (miktar){
                        var birikim = fiyatlars[0];
                        var yeni = addDevletKatkisi(birikim, katki, miktar);
                        return [yeni, fiyatlars[1]];
                    });
                });
                
            };
        }
        
        const besDataTL = Promise.all(besDataTLAll).then(aligner);
        this.besPortfoyTl = besDataTL
            .then(buyer(TLmiktarP, "BES", fixedExchanger, inflation, 'purple'))
            .then(addDevlet(katkiTL, TLmiktarP));


        // const besDataEuro = Promise.all(besDataEuroAll).then(aligner);
        // this.besPortfoyEuro = besDataEuro.then(buyer(euroMiktar, "BES EURO Portfoy", euroExchnager, fixedInlfation));
        // this.besPortfoyEuroTL = this.besPortfoyEuro
        //     .then(converter(EURODaily))
        //     .then(addDevlet(katkiEURO, euroMiktar));                                

        // const besDataUSD = Promise.all(besDataUSDAll).then(aligner);
        // this.besPortfoyUSD = besDataUSD.then(buyer(dolarMiktar, "BES USD Protfoy", dolarExchanger, fixedInlfation));
        // this.besPortfoyUSDTL = this.besPortfoyUSD
        //     .then(converter(USDDaily))
        //     .then(addDevlet(katkiUSD, dolarMiktar));

        /* this.USDPortfoy = Promise.all([USDDaily])
         *     .then( x=> [new Fiyatlar(x[0].isim, getMonthStarts(x[0].veri), x[0].agirlik)])
         *     .then(aligner)            
         *     .then(buyerExchange(dolarMiktar, "USD Birikim"));
         */

        this.USDPortfoy = Promise.all([USDDaily])
            .then( x=> [new Fiyatlar(x[0].isim, getMonthStarts(x[0].veri), x[0].agirlik, x[0].color)])
            .then(aligner)
            .then(buyer(TLmiktarP, "USD", fixedExchanger, inflation,  '#99cc66'));

        


        
        /* 
         *         this.EUROPortfoy = Promise.all([EURODaily])
         *             .then( x=> [new Fiyatlar(x[0].isim, getMonthStarts(x[0].veri), x[0].agirlik)])
         *             .then(aligner)
         *             .then(buyerExchange(euroMiktar, "EURO Birikim"));
         *  */

        
        
        this.EUROPortfoy = Promise.all([EURODaily])
            .then( x=> [new Fiyatlar(x[0].isim, getMonthStarts(x[0].veri), x[0].agirlik, x[0].color)])
            .then(aligner)
            .then(buyer(TLmiktarP, "EURO", fixedExchanger, inflation, '#000099'));
        



        const otherAligner = function(fiyatlar, otherP){
            return otherP.then (x => [alignWithOther(fiyatlar, x)]);
        };
        
        this.AltinPortfoy = Promise.all([AltinDaily])
            .then(x => otherAligner(x[0], besDataTL))
            .then(aligner).then(printPromise("altin algined"))
            .then(buyer(TLmiktarP, "Altin", fixedExchanger, inflation, 'gold'));
        
        this.FaizPortfoy = Promise.all([FaizDaily])
            .then(x => otherAligner(x[0], besDataTL))
            .then(aligner).then(printPromise("Faiz algined"))
            .then(faizci(TLmiktarP, "Faiz", fixedExchanger, inflation, 'red'));
        
        //            .then(buyerExchange(altinMiktar, "Altin Birikim"));

        
    }
}

function dateToStr(date){
    return `${date.getUTCFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
}

var errorLogger = function(err){console.log(err);};

function drawBarChart(fiyatlar, divId, title) {
    console.log("drawchart", fiyatlar);
    // Create the data table.
    var data = new google.visualization.DataTable();
    data.addColumn('date', 'Tarih');
    fiyatlar.forEach(function(v){data.addColumn('number',v.isim);});
    var first = fiyatlar[0];
    const ticks = first.veri.map( x=> x[0]);
    var rest = fiyatlar.slice(1);
    first.veriler.forEach(function(v,k,m) {
        var row =[];
        row.push(new Date(k));
        row.push(v);
        rest.forEach(function(x){            
            row.push(x.veriler.get(k));
        });
        console.log("adding row", row);
        data.addRow(row);
    });
    const colors = fiyatlar.map(x=>x.color);
    var options = {
        //width: 400,
        height: 540,
       colors: colors,
        animation:{
            duration: 2000,
            easing: 'out',
            startup: true
        },
        vAxis: {minValue:0, maxValue:200},               
        title: title,
        legend: { position: 'right' , fontSize: 6},
        explorer: { 
            actions: ['dragToZoom', 'rightClickToReset'],
            axis: 'horizontal',
            keepInBounds: true,
            maxZoomIn: 4.0
        },
 
    };

    

    // Instantiate and draw our chart, passing in some options.
    var chart = new google.visualization.ColumnChart(document.getElementById(divId));
    chart.draw(data, options);
}


function drawSingleBarChart(fiyatlars, divId, title) {
    console.log("draw single chart", fiyatlars);
    // Create the data table.
    const mapped = fiyatlars.map(x => [x.isim, x.veri[0][1], x.color]);
    const header = ["Arac", "Birikim", { role: 'style' }];
    mapped.unshift(header);

    const data = google.visualization.arrayToDataTable(mapped);
    var options = {
        //width: 400,
        height: 540,
        animation:{
            duration: 2000,
            easing: 'out',
            startup: true
        },
        vAxis: {minValue:0, maxValue:200},               
        title: title,       
        legend: 'none',
        explorer: { 
            actions: ['dragToZoom', 'rightClickToReset'],
            axis: 'horizontal',
            keepInBounds: true,
            maxZoomIn: 4.0
        },
 
    };

    

    // Instantiate and draw our chart, passing in some options.
    var chart = new google.visualization.ColumnChart(document.getElementById(divId));
    chart.draw(data, options);
}








function drawLineChart(fiyatlar, divId, title) {
    console.log("drawchart", fiyatlar);
    // Create the data table.
    var data = new google.visualization.DataTable();
    data.addColumn('date', 'Tarih');
    fiyatlar.forEach(function(v){data.addColumn('number',v.isim);});
    var first = fiyatlar[0];
    const ticks = first.veri.map( x=> x[0]);
    var rest = fiyatlar.slice(1);
    first.veriler.forEach(function(v,k,m) {
        var row =[];
        row.push(new Date(k));
        row.push(v);
        rest.forEach(function(x){            
            row.push(x.veriler.get(k));
        });
        //        console.log("adding row", row);
        data.addRow(row);
    });

    const colors = fiyatlar.map(x=>x.color);
    var options = {
        //      width: 400,
        height: 540,
        colors: colors,
        animation:{
            duration: 2000,
            easing: 'out',
            startup: true
        },
        vAxis: {minValue:0, maxValue:200},               
        title: title,
        curveType: 'function',
        legend: { position: 'bottom' , fontSize: 6},
        explorer: { 
            actions: ['dragToZoom', 'rightClickToReset'],
            axis: 'horizontal',
            keepInBounds: true,
            maxZoomIn: 4.0
        },
        hAxis: {
            ticks: ticks,
            format: 'yyyy-MM'
        }
        
    };

    

    // Instantiate and draw our chart, passing in some options.
    var chart = new google.visualization.LineChart(document.getElementById(divId));
    chart.draw(data, options);
}






function newFiyatlar(kod, selected, agirlik, color){
    return new Fiyatlar(kod, selected, agirlik, color);
}

function loadUSDData(kod, agirlik) {
        var path = `besdata/${kod}/dolar.csv`;
    return loadData(path, kod, agirlik, newFiyatlar, '#99cc66');    
}

function loadTLData(kod, agirlik) {
    var path = `besdata/${kod}/data.csv`;
    return loadData(path, kod, agirlik, newFiyatlar);    
}

function loadEuroData(kod, agirlik) {
    var path = `besdata/${kod}/euro.csv`;
    return loadData(path, kod, agirlik, newFiyatlar);    
}

const AltinDaily = loadData('besdata/altin.csv', "ALTIN", 1, newFiyatlar, monthlyParser).then(printPromise("altin load")).then(convertMonthlyToDaily).then(printPromise("altin daily"));

const USDDaily =  loadData('besdata/dolar.csv', "DOLAR", 1, newFiyatlar,  '#99cc66');
const EURODaily =  loadData('besdata/euro.csv', "EURO", 1, newFiyatlar);
const FaizDaily = loadData('besdata/faiz.csv', "FAIZ", 1, newFiyatlar, monthlyParser).then(printPromise("faiz load")).then(convertMonthlyToDaily).then(printPromise("faiz daily"));


function loadData(path, kod, agirlik, callback, color, dateParser = stdDateParser) {
    //    var file = new File(path);
    return new Promise(function(resolve, reject){
        Papa.parse(path, {
            download: true,
	    complete: function(results) {
                var selected = results.data;
//	        console.log("Finished kod:", kod, selected);
                resolve(callback(kod, selected, agirlik, color));
	    },
            error: function(error, file){
                reject(error);
            },
            transform: function(veri, headerName){
                if(headerName == 0){
                    return dateParser(veri);
                }
                if(headerName == 1){
                    return parseFloat(veri);
                }
                return veri;
            }
        });
    });
    
}


function loadBesData(urlParams, dataLoader){
    var promises = [];
    const added = new Set([]);
    for(var kv of urlParams.entries()){
        if(!added.has(kv[0])){
            promises.push(dataLoader(kv[0], kv[1]).then(function(v){
                const a = getMonthStarts(v.veri);
                return new Fiyatlar(v.isim, a, v.agirlik, v.color);
            }, errorLogger));
        }
     added.add(kv[0]);      
    }
    
           
    return promises;
}


//list of tuples [["2008-12-25", "0.002"]]
function getMonthStarts(veriler){
    var index=0;
    var arr = [];
    while(index < veriler.length){
        var date = veriler[index][0];
        var money = veriler[index][1];
        if(money !== 0.0){
            break;
        }
        index++;
    }

    var lastDate = veriler[index][0];

    while(index < veriler.length){
        date = veriler[index][0];
        if(date.getMonth() != lastDate.getMonth()){
            arr.push(veriler[index]);
            lastDate = date;
        }
        index++;
    }
    return arr;     
}


function alignedDate(fiyatlar, desiredStartDate){
    var maxDate = new Date(1,1,1);
    var firstElements = [];
    var reason = '';
    fiyatlar.forEach(function(fiyat){firstElements.push({min:fiyat.veri[0][0] , isim: fiyat.isim});});
    firstElements.forEach(function(date){
        if(date.min > maxDate){
            maxDate = date.min;
            reason = date.isim;
        }
    });

    var tempDate ;
    //fonlar istenen zamandan gec basliyorsa
    if (maxDate > desiredStartDate) {
        tempDate = maxDate;
        return {date: tempDate, reason: reason};
    } else {
        //istenen zamani aybasi ile lign ediyor
        tempDate = desiredStartDate;
        tempDate.setDate(1);
        const veriler = fiyatlar[0].veriler;
        while(!veriler.has(dateToStr(tempDate))){
            tempDate.setDate(tempDate.getDate() + 1);
        }
        return {date: tempDate, reason: ''};
    }



}


function alignDates(fiyatlar, maxDate){
    var result = fiyatlar.map(function(fiyat){
        const veri = fiyat.veri.filter(function(elem){return elem[0] >= maxDate;});
        return new Fiyatlar(fiyat.isim, veri, fiyat.agirlik, fiyat.color);
    }

    );
//    console.log("aligned dates", result);
    return result;
}


function buyFiyatlar(fiyatlars, initMiktar, isim, miktarConverter, inflationAdjuster, color){
    console.log("bes fiyatlar", fiyatlars);
    
    var lastMiktar = new Map();
    fiyatlars.forEach(function(f){lastMiktar.set(f.isim, 0.0);});
    var tumAgirliklar = 0;
    fiyatlars.forEach(function(f){tumAgirliklar += f.agirlik*1.0;});
    var degerler = [];
    var yatirilanlar = [];
    var first = fiyatlars[0];
    var rest = fiyatlars.slice(1);
    var yatirilan = 0;
    var initDate = first.veri[0][0];    
    first.veri.forEach(function(fiyat){
        var date = fiyat[0];
        var dateStr = dateToStr(date);
        var currentPortfolio = 0;
        const miktar = inflationAdjuster(initDate, date, initMiktar);
        const odenen = miktarConverter(miktar, dateStr);
//        console.log("fiyatlar odeen", odenen);
        yatirilan += odenen;
        fiyatlars.forEach(function(fiyatlar){
            const currentPrice = fiyatlar.veriler.get(dateStr);
            const alinacak = miktar * (fiyatlar.agirlik/tumAgirliklar);
            const currentQuantity = alinacak / currentPrice;
            const quantityBefore = lastMiktar.get(fiyatlar.isim);
            const sumQuantity = currentQuantity + quantityBefore;
            currentPortfolio = currentPortfolio + (sumQuantity * currentPrice);
            lastMiktar.set(fiyatlar.isim , sumQuantity);
        });
        degerler.push([date, currentPortfolio]);
        yatirilanlar.push([date, yatirilan]);
    });
    
    return [new Fiyatlar(isim, degerler, 100, color), new Fiyatlar(isim, yatirilanlar, 100, color)];                      
}



function investFaiz(fiyatlars, initMiktar, isim, miktarConverter, inflationAdjuster, color){
    console.log("faiz fiyatlar", fiyatlars);
    
    var lastMiktar = new Map();
    var degerler = [];
    var yatirilanlar = [];
    var first = fiyatlars[0];
    var yatirilan = 0;
    var initDate = first.veri[0][0];
    var currentPortfolio = 0 ;
    first.veri.forEach(function(fiyat){
        var date = fiyat[0];
        var dateStr = dateToStr(date);
        const miktar = inflationAdjuster(initDate, date, initMiktar);
        const odenen = miktarConverter(miktar, dateStr);
        //        console.log("fiyatlar odeen", odenen);
        yatirilan += odenen;
//        var effectiveInteres = ( Math.pow((100+fiyat[1])/100, 1/12.0) - 1)*0.85 ;
        //var effectiveInteres = (fiyat[1]/12)/100  *0.85 ; // r ^ 1/12 den ya da 1/360 *30 dan hesaplamak lazim da faiz hep dusuk. cok fark etmiyor
        var effectiveInteres = (fiyat[1]/12)/100   ; //Stopaji iptal ettim, BES de dahil etmiyoruz cunku.
        currentPortfolio = currentPortfolio * (1+effectiveInteres) + odenen;

        degerler.push([date, currentPortfolio]);
        yatirilanlar.push([date, yatirilan]);
    });
    console.log("faize giden", yatirilanlar);
    return [new Fiyatlar(isim, degerler, 100, color), new Fiyatlar(isim, yatirilanlar, 100, color)];                      
}

function buyExchange(fiyatlars, miktar, isim, color){
    console.log("exchnage miktar", miktar);
    console.log("amk", fiyatlars);
    const exchange = fiyatlars[0];
    var yatirilanlar = [];
    var portfoyDeger = [];
    var sonMiktarFX = 0;
    var yatirilan = 0;
    exchange.veri.forEach(function(fiyat){
        var date = fiyat[0];
        var dateStr = dateToStr(date);
        const exchangeRate = exchange.veriler.get(dateStr);
        const odenen = miktar * exchangeRate;
//        console.log("exc odenen", odenen);
        yatirilan = yatirilan + odenen;
        yatirilanlar.push([date,yatirilan]);
        sonMiktarFX +=  miktar;
        portfoyDeger.push([date,sonMiktarFX*exchangeRate]);
    });    
    
    var odenenIsim = `${isim}-Odenen-TL`;
    var birikenIsim = `${isim}-Portfoy-TL`;
    return [new Fiyatlar(isim, portfoyDeger, 1, color), new Fiyatlar(isim, yatirilanlar, 1, color)];                        
}
const DevletKatkisiBaslangici = new Date(2013,5,1);

function addDevletKatkisi(fiyatlar, katkiFonu, miktar){
    var yeniDeger = [];
    var sonMiktar = 0;
    fiyatlar.veri.forEach(function(fiyat){
        var date = fiyat[0];
        if (date > DevletKatkisiBaslangici) {
            const rate = katkiFonu.veriler.get(dateToStr(date));
            const alinan = (miktar*0.25)/rate;
            sonMiktar = sonMiktar + alinan;
            const eklenmis = fiyat[1] + (sonMiktar * rate);
            yeniDeger.push([date, eklenmis]);         
        } else {
            yeniDeger.push([date, fiyat[1]]);
        }
    });
    return new Fiyatlar(`${fiyatlar.isim} - Devlet Katkili`, yeniDeger, 1, fiyatlar.color);
    
}

function convertToTL(fiyatlar, lookUp){
    var veriler = [];
    
    fiyatlar.veri.forEach(function(kv){
        var strDate = dateToStr(kv[0]);
        if(!lookUp.get(strDate)){
            console.log("price is null", strDate);
//            console.log("lookup", lookUp);
        }

        const price = lookUp.get(strDate);
        veriler.push([kv[0], price*kv[1]]);
    });
    return new Fiyatlar(fiyatlar.isim, veriler, 1, fiyatlar.color);
}


var infData = new Map();
infData.set(2003,100.00);
infData.set(2003,100.00);
infData.set(2004,108.60);
infData.set(2005,117.48);
infData.set(2006,128.76);
infData.set(2007,140.03);
infData.set(2008,154.66);
infData.set(2009,164.32);
infData.set(2010,178.40);
infData.set(2011,189.95);
infData.set(2012,206.84);
infData.set(2013,222.33);
infData.set(2014,242.02);
infData.set(2015,260.59);
infData.set(2016,280.85);
infData.set(2017,312.14);
infData.set(2018,363.13);


function enflasyoncu(initDate, date, miktar, inflationData){
    const initYear = initDate.getUTCFullYear();
    const currentYear = date.getUTCFullYear()-1;
    if (initYear >= currentYear){
        return miktar;
    }
    return Math.floor((inflationData.get(currentYear) /  inflationData.get(initYear)) * miktar);
}

function sifirEnflasyon(initDate, date, miktar, inflationData){
    return miktar;
}


function getBirikim(promises){
    return Promise.all(promises).then(fiyatlars => {
        const birikim = fiyatlars.map(f => f[0]);
        const f = fiyatlars[0];
        const odenenSon = new Fiyatlar("Yatirilan" ,f[1].veri, 1, 'black');
        birikim.push(odenenSon);
        return birikim;

    }); 
}

function getOdenen(promises){
    return Promise.all(promises).then(fiyatlars => {
        return fiyatlars.map(f => f[1]);
    }); 
}

function getSonBiriken(promises){
    return Promise.all(promises).then(fiyatlars => {
        const sonBiriken = fiyatlars.map(f => new Fiyatlar(f[0].isim,[f[0].veri.slice(-1)[0]], 1, f[0].color));
        const f = fiyatlars[0];
        const odenenSon = new Fiyatlar("Yatirilan" ,[f[1].veri.slice(-1)[0]], 1, 'black');
        sonBiriken.push(odenenSon);
        return sonBiriken;
    }); 
}


function getSonOdenen(promises){
    return Promise.all(promises).then(fiyatlars => {
        return fiyatlars.map(f => f[1].veri.slice(-1)[0]);
    }); 
}


function getGetiri(promises){
    return Promise.all(promises).then(fiyatlars => {
        return fiyatlars.map(f => {
            const biriken = f[0].veri;
            const odenen = f[1].veri;
            const oran = biriken.map((x, i) => [x[0], (x[1] / odenen[i][1]) * 100 - 100]);
            return new Fiyatlar(f[0].isim, oran, 1, f[0].color);
        });
    }); 
}


function getSample(fiyatlar){
    console.log("fiaylat", fiyatlar);
    var yeniVeri = [];
    var index = 0;
    var now = new Date();
//    yeniVeri.push(fiyatlar.veri[0]);
    while(index < fiyatlar.veri.length -1){
        if(fiyatlar.veri[index][0].getMonth() == 0 && (now.getFullYear() != fiyatlar.veri[index][0].getFullYear() )){
            yeniVeri.push(fiyatlar.veri[index]);
        }
        index = index + 1;
    }
        yeniVeri.push(fiyatlar.veri[fiyatlar.veri.length -1]);

    
    return new Fiyatlar(fiyatlar.isim, yeniVeri, fiyatlar.agirlik, fiyatlar.color);
}

function convertMonthlyToDaily(fiyatlar){
    var yeniVeri = [];
    var index = 0;
//    yeniVeri.push(fiyatlar.veri[0]);
    while(index < fiyatlar.veri.length -1){
        var indexDate = fiyatlar.veri[index][0];
        var indexPrice = fiyatlar.veri[index][1];
        var indexMonth = indexDate.getMonth();
        var nextMonth = (indexMonth+1) % 12;
        
        while (indexMonth < nextMonth || (indexMonth ==11 && nextMonth ==0)){
            yeniVeri.push([indexDate, indexPrice]);
            var d = new Date(indexDate.getTime());
            d.setDate(d.getDate()+1);
            indexDate = d;
            indexMonth = indexDate.getMonth();
        }
        
        index++;
    }
    
    return new Fiyatlar(fiyatlar.isim, yeniVeri, fiyatlar.agirlik, fiyatlar.color);

}


function alignWithOther(fiyatlar, other){
    console.log("fiyatlar", fiyatlar);
    
    var yeniVeri = [];
    other[0].veri.forEach(v => {
        var date  = v[0];
        const price = fiyatlar.veriler.get(dateToStr(date));
        yeniVeri.push([date, price]);            
    });
    return new Fiyatlar(fiyatlar.isim, yeniVeri, fiyatlar.agirlik, fiyatlar.color);
}

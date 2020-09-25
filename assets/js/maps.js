/* global google */ // defines google as a global value for ESLint without effecting google's API code.
var map, infoWindow;
let routeData, formInputs;

// Loads initial inputs for start/origin
$(document).ready(function () {
   routeData = new WayPointsData();
   formInputs = new HTMLInputs(routeData);
});

// ESLint cannot see the callback for initMap in index.html so needs next time to stop Lint complaints.
// eslint-disable-next-line no-unused-vars
function initMap() {
   const directionsService = new google.maps.DirectionsService();
   const directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
   });
   map = new google.maps.Map(document.getElementById("map"), {
      center: { lat: -34.397, lng: 150.644 },
      zoom: 8,
   });
   directionsRenderer.setMap(map);

   $(`.btn`).click(function () {
      const newRoute = new DirectionsRequest(routeData);
      const weatherAPI = new WeatherRequest(routeData, function () {
         console.log(newRoute);
         calculateAndDisplayRoute(
            directionsService,
            directionsRenderer,
            newRoute
         );
      });
   });
}

class DirectionsRequest {
   constructor(wayPointsData) {
      this.origin = wayPointsData.origin().location.formatted_address;
      this.destination = wayPointsData.destination().location.formatted_address;
      // this.waypoints = wayPointsData.waypts;
      this.travelMode = `DRIVING`;
      // // transitOptions;
      // this.drivingOptions=""
      // this.unitSystem = UnitSystem.IMPERIAL;
      // this.waypoints=[];
      // // this.optimizeWaypoints = true;
      // // this.provideRouteAlternatives = false;
      // this.avoidFerries = true;
      // // this.avoidHighways="";
      // // this.avoidTolls="";
      // // this.region="";
   }
}

function calculateAndDisplayRoute(
   directionsService,
   directionsRenderer,
   directionsRequest
) {
   directionsService.route(directionsRequest, function (result, status) {
      if (status === "OK") {
         directionsRenderer.setDirections(result);
         const leg = result.routes[0].legs[0];
         routeData.origin().googleLatLng = leg.start_location;
         routeData.destination().googleLatLng = leg.end_location;

         for (const input of formInputs.inputArray) {
            const icon = `/assets/img/${input.locationData.weatherData.weatherDescription[0].icon}@2x.png`;
            const latLng = input.locationData.googleLatLng;
            const info = input.locationData.weatherData;
            input.weatherMarker(latLng, icon, info);
         }
         console.log(result);
      } else {
         window.alert("Directions request failed due to " + status);
      }
   });
}

class WeatherRequest {
   constructor(wayPointsData, callback) {
      this.openWeatherMapKey = "56d76261127ba6fda7f5aeed21fd5ffd";
      this.wayPointsData = wayPointsData;
      this.callbackCount = 1;
      this.wayPointsData.locations.forEach((waypoint) => {
         // use of lat() lng() found in google maps documentation https://developers.google.com/maps/documentation/javascript/reference/coordinates#LatLng
         const lat = waypoint.location.geometry.location.lat();
         const lng = waypoint.location.geometry.location.lng();
         const weatherString =
            "https://api.openweathermap.org/data/2.5/onecall?lat=" +
            lat +
            "&lon=" +
            lng +
            "&exclude-minutely&units=metric&appid=" +
            this.openWeatherMapKey +
            "";
         // Use of http request and passing to another class found in code institute interactive front end module and at
         // https://github.com/google/maps-for-work-samples/blob/master/samples/maps/OpenWeatherMapLayer/index.html
         const weatherRequest = new XMLHttpRequest();
         weatherRequest.open("get", weatherString);
         weatherRequest.send();
         weatherRequest.onload = () => {
            this.callbackCount += 1;
            waypoint.weather = JSON.parse(weatherRequest.responseText);
            console.log(waypoint.weather);
            const formatter = new WeatherFormatter(
               weatherRequest.responseText,
               waypoint
            );
            if (this.callbackCount === this.wayPointsData.locations.length)
               callback();
         };
      });
   }
}

$("#waypointbtn").click(function () {
   formInputs.addWaypoint(formInputs.wayPointsData);
});

class WeatherData {
   constructor() {
      this.dateTime = "";
      this.weatherDescription = "";
      this.temperature = "";
      this.rain = "";
      this.clouds = "";
      this.wind = "";
      this.uvi = "";
      this.realFeel = "";
      this.humidity = "";
   }
}

// LocationData holds the individual input's location, date time and id values so they can be passed between the html view model and different api's without repeating.
class LocationData {
   constructor(weatherData) {
      this.location = "";
      this.dateTime = "";
      this.googleLatLng = "";
      this.id = "";
      this.weatherData = weatherData;
   }
}

// LocationView holds properties matching locationData and a references to the input element in html and acts as a way to pass data between javascript storage and the view model.
// initialise() is called upon construction as this generates the html element which is referenced along with the auto complete associated with the specific element.
class LocationView {
   constructor(locationData) {
      this.locationData = locationData;
      this.initalise();
      this.marker = new google.maps.Marker({
         map: map,
         icon: "/assets/img/blu-blank.png",
      });
      this.infoWindow = new google.maps.InfoWindow({ maxWidth: 300 });
   }

   // Creates a new HTML input for text and date time using jquery then assigns the elements to a location and datetime variable for google autocomplete and generic value storage.
   initalise() {
      if (formInputs === undefined) {
         $(`<input type="text" class="col-7 form-control" id="${this.locationData.id}-input" name="${this.locationData.id}-input" placeholder="Search Destination">
       <input type="datetime-local" class="col-5 form-control" id="${this.locationData.id}-date" name="${this.locationData.id}-date">`).appendTo(
            ".route-form"
         );
      } else {
         const newInput = $(`<input type="text" class="col-7 form-control" id="${this.locationData.id}-input" name="${this.locationData.id}-input" placeholder="Search Destination">
       <input type="datetime-local" class="col-5 form-control" id="${this.locationData.id}-date" name="${this.locationData.id}-date">`).insertBefore(
            "#destination-input"
         );
      }

      this.setUpdateAutocomplete();
      this.setUpdateDateTime();
   }

   setUpdateAutocomplete() {
      const location = new google.maps.places.Autocomplete(
         document.getElementById(`${this.locationData.id}-input`)
      );
      // Arrow function => used as it does not change the scope of this from the class. Found explanation at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
      location.addListener(`place_changed`, () => {
         // gotten from google -> where?
         const place = location.getPlace();
         if (place.length === 0) {
            alert("Please select an appropriate Location");
         }
         this.addMarker(place, map);
         const bounds = new google.maps.LatLngBounds();
         if (!place.geometry) {
            return;
         } else if (place.geometry.viewport) {
            bounds.union(place.geometry.viewport);
         } else {
            bounds.extend(place.geometry.viewport);
         }
         map.fitBounds(bounds);
         this.locationData.location = place;
         console.log(this.locationData);
      });
   }

   // assigns value of datetime-local to locationData property when input is changed.
   setUpdateDateTime() {
      const dateTime = document.getElementById(`${this.locationData.id}-date`);
      // => used instead of function as it does not change the scope of this from the class. Found explanation at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions
      $(dateTime).on(`change`, () => {
         // check if date is inserted and after current date. Converts to unix time stamp in seconds to compared to weather JSON.
         this.locationData.dateTime = dateTime.valueAsNumber / 1000;
         console.log(this.locationData);
      });
   }

   // Takes property of constructed marker and sets new position.
   addMarker(latLng) {
      this.marker.setPosition(latLng.geometry.location);
      this.marker.setIcon("/assets/img/blu-blank.png");
      google.maps.event.clearInstanceListeners(this.marker);
      this.infoWindow.close();
      // remove event listener found at https://developers.google.com/maps/documentation/javascript/reference/event#event.removeListener
      if (this.infoWindow.content === true) {
         this.marker.removeListener("click");
      }
   }

   weatherMarker(latLng, icon, info) {
      this.marker.setPosition(latLng);
      this.marker.setIcon(icon);
      this.infoWindow.close();
      const contentString = `<div class="content container">
            <div class="row">
               <h3 class="col-12 description text-capitalize">${info.weatherDescription[0].description}</h3>
               <p class="col-6">Cloud cover: ${info.clouds}%</p>
               <p class="col-6">Rain: ${info.rain} mm</p>
               <p class="col-6">Wind: ${info.wind} m/s</p> 
               <p class="col-6">Real Feel: ${info.realFeel}&#8451;</p>
               <p class="col-6">UV Index: ${info.uvi}</p>
               <p class="col-6">Temperature: ${info.temperature}&#8451;</p>
            </div>
         </div>`;
      // &#8451; for degrees celsius found at https://www.w3schools.com/charsets/ref_utf_letterlike.asp
      this.infoWindow.setContent(contentString);
      this.marker.addListener("click", () => {
         this.infoWindow.open(map, this.marker);
      });
   }
}

// WaypointData holds an array of locationData classes and all the subsequent information. Used to pass to apis in a group per form submission rather than individual instances.
class WayPointsData {
   constructor() {
      this.locations = [];
      // Properties are set using arrow functions so they can be called when needed and are availavle rather than when constructed. Reference: https://www.w3schools.com/js/js_arrow_function.asp
      // Find used to select for an array element found at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
      this.origin = () => {
         const startPoint = this.locations.find((location) => {
            return location.id === "origin";
         });
         return startPoint;
      };

      this.destination = () => {
         const endPoint = this.locations.find((location) => {
            return location.id === "destination";
         });
         return endPoint;
      };
      // possibel use later { address:endPoint.location.formatted_address , latlng: endPoint.location.latlng }
   } // found filter at https://stackoverflow.com/questions/7364150/find-object-by-id-in-an-array-of-javascript-objects
   // this.waypts = this.locations.filter(function(element){return element.id !== "origin" || element.id !== "destination"});
}

class HTMLInputs {
   constructor(wayPointsData) {
      // Constructor is called once when page loads and is very similar to addWayPoint(), instead using a for loop to create two new elements and
      // changing the first element's Id to origin and the second to destination so they can be passed to directionRequest instance.
      this.wayPointsData = wayPointsData;
      this.inputArray = [];
      for (let i = 0; i < 2; i++) {
         this.newPageWeather = new WeatherData();
         this.newPageLocations = new LocationData(this.newPageWeather);
         wayPointsData.locations.push(this.newPageLocations);
         if (i === 0) {
            this.newPageLocations.id = `origin`;
         } else {
            this.newPageLocations.id = `destination`;
         }
         this.newPageInputs = new LocationView(this.newPageLocations);
         this.inputArray.push(this.newPageInputs);
      }
   }

   // addWayPoint function creates a new instance of LocationData which is passed as a parameter to a new instance of LocationView
   // The new LocationView instances create the required HTML and autocomplete instances for index.HTML which user interacts with.
   // The wayPointsData class and inputArray[] store locationData and LocationView respectively so they can be accessed and manipulated later.
   addWaypoint() {
      const number = Math.floor(Math.random() * 100 + 1);
      const newWeatherData = new WeatherData();
      const newLocationData = new LocationData(newWeatherData);
      newLocationData.id = `waypoint${number}`;
      this.wayPointsData.locations.push(newLocationData);
      const newWayPointHTML = new LocationView(newLocationData);
      this.inputArray.push(newWayPointHTML);
   }

   removeWayPoint() {}
}

class WeatherFormatter {
   constructor(weatherRequest, waypoint) {
      this.waypoint = waypoint;
      this.weatherData = waypoint.weatherData;
      // Code to get new date and assess milliseconds to seconds found at https://stackoverflow.com/questions/221294/how-do-you-get-a-timestamp-in-javascript#:~:text=The%20value%20returned%20by%20the,00%3A00%3A00%20UTC.&text=The%20code%20Math.,new%20Date%20%2F%201E3%20%7C%200%20.
      this.twoDaysAway = () => {
         const today = new Date();
         today.setDate(today.getDate() + 2);
         const twoDays = Math.round(today.getTime() / 1000);
         console.log(waypoint.dateTime);
         console.log(twoDays);
         return twoDays;
      };
      this.formatWeather(weatherRequest);
   }

   // formats and organises the JSON weather data and selects whether a user selected time required hourly, daily or current time selection byt measuring if within next 2 days of
   // hourly time slots or not. Then compares time requested via input against each arrays time forecasts to select appropriate data
   formatWeather(weatherRequest) {
      const results = JSON.parse(weatherRequest);
      const waypointTime = this.waypoint.dateTime;
      let timeframe;
      if (waypointTime === "") {
         timeframe = results.current;
      } else if (waypointTime > this.twoDaysAway()) {
         // checks data for i and next index above; if [i] is smaller and [i+1] is bigger, takes [i] as closest forecast. Stops at length -1 as i+1 does not exist.
         for (var t = 0; t < results.daily.length - 1; t++) {
            if (
               waypointTime >= results.daily[t].dt &&
               waypointTime <= results.daily[t + 1].dt
            ) {
               timeframe = results.daily[t];
               console.log(timeframe);
            }
         }
         // If data is somehow between boundary of daily and hourly slots then data will stop befoe hitting full array length and assume last index as its forecast.
         // This was chosen since the timestamp was obviously not suitable for the other daily/hourly intervals so takes the biggest value it can find as accurate.
         if (timeframe === undefined) {
            timeframe = results.daily[results.daily.length - 1];
         }
      } else {
         for (var s = 0; s < results.hourly.length; s++) {
            if (
               waypointTime >= results.hourly[s].dt &&
               waypointTime <= results.hourly[s + 1].dt
            ) {
               timeframe = results.hourly[s];
               console.log(timeframe);
               break;
            }
         }
         if (timeframe === undefined) {
            timeframe = results.hourly[results.hourly.length - 1];
         }
      }
      this.assignWeather(timeframe);
   }

   // Assigns all values properties to the relevant time frame and its data.
   assignWeather(timeframe) {
      this.timeframe = timeframe;
      this.weatherData.dateTime = timeframe.dt;
      this.weatherData.weatherDescription = timeframe.weather;
      this.temperature = "";
      if (typeof timeframe.temp === "object") {
         this.weatherData.temperature = timeframe.temp.day;
      } else {
         this.weatherData.temperature = timeframe.temp;
      }
      this.realFeel = "";
      if (typeof timeframe.feels_like === "object") {
         this.weatherData.realFeel = timeframe.feels_like.day;
      } else {
         this.weatherData.realFeel = timeframe.feels_like;
      }
      this.weatherData.rain = timeframe.rain;
      if (typeof timeframe.rain === "object") {
         this.weatherData.rain = timeframe.rain["1h"];
      } else {
         this.weatherData.rain = timeframe.rain;
      }
      this.weatherData.clouds = timeframe.clouds;
      this.weatherData.wind = timeframe.wind_speed;
      this.weatherData.uvi = timeframe.uvi;
      this.weatherData.humidity = timeframe.humidity;
      for (const property in this.weatherData) {
         if (this.weatherData[property] === undefined) {
            this.weatherData[property] = "N/A";
         }
      }
   }
}

class LocationFormatter {
   constructor() {
      this.filler = "";
   }
}

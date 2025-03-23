import { z } from "zod";
import axios from "axios";
import { defineDAINService, ToolConfig, ServicePinnable } from "@dainprotocol/service-sdk";
import { AlertUIBuilder, TableUIBuilder, LayoutUIBuilder, ChartUIBuilder,ImageCardUIBuilder, DainResponse, CardUIBuilder, MapUIBuilder } from "@dainprotocol/utils";

const port = Number(process.env.PORT) || 2022;
const apiKey = '6ca0b6efffe246cda90e204dc02085e6';

interface PlaceProperties {
  name?: string;  // Make 'name' optional
  categories: string[];
  formatted?: string;  // Make 'formatted' optional
}

interface GeoapifyResponse {
  features: Array<{
    properties: PlaceProperties;
    geometry: {
      type: string;
      coordinates: [number, number];  // [longitude, latitude]
    };
  }>;
}

const getFunRec: ToolConfig = {
  id: "get-FunRec",
  name: "Get FunRec",
  description: "Fetches fun activities around the area",
  input: z
    .object({
      locationName: z.string().describe("Location name"),
      latitude: z.number().describe("Latitude coordinate"),
      longitude: z.number().describe("Longitude coordinate"),
    })
    .describe("Input parameters for the Fun Activities"),
  output: z
    .object({
      places: z.array(
        z.object({
          name: z.string().optional(),
          category: z.string(),
          address: z.string().default("No address available"),
        })
      ),
    })
    .describe("List of places with fun Activities"),
  pricing: { pricePerUse: 0, currency: "USD" },
  
  handler: async ({ locationName, latitude, longitude }, agentInfo, context) => {
    console.log(
      `User / Agent ${agentInfo.id} requested activities at ${locationName} (${latitude},${longitude})`
    );

    try {
      const response = await axios.get<GeoapifyResponse>(
        `https://api.geoapify.com/v2/places?lat=${latitude}&lon=${longitude}&categories=tourism,leisure&limit=10&apiKey=${apiKey}`
      );

      const places = response.data.features;

      // Handle empty results
      if (places.length === 0) {
        return {
          text: `No fun activities found near ${locationName}.`,
          data: {},
          ui: new CardUIBuilder()
            .setRenderMode("page")
            .title(`No Activities Found`)
            .content(`Sorry, we couldn't find any activities in ${locationName}. Try another location!`)
            .build(),
        };
      }

      const placeList = places.map((place) => {
        let name = place.properties.name;
        if (name === undefined) return null;  // Skip places without a name

        const placeLatitude = place.geometry.coordinates[1];  // Correcting to use latitude
        const placeLongitude = place.geometry.coordinates[0]; // Correcting to use longitude
        const address = place.properties.formatted || "No address available";  // Fallback if address is missing

        return {
          name: name,
          category: place.properties.categories.join(", "),
          address: address, // Ensure this is always a string
          latitude: placeLatitude,
          longitude: placeLongitude,
        };
      }).filter((place) => place !== null);  // Filter out null values

      const placesText = placeList
        .map((place, index) => `${index + 1}. ${place.name} - ${place.address}`)
        .join("\n");

      return {
        text: `Here are some fun activities in ${locationName}:\n${placesText}`,
        data: {
          places: placeList,
        },
        ui: new CardUIBuilder()
          .setRenderMode("page")
          .title(`Fun Activities in ${locationName}`)
          .addChild(
            new MapUIBuilder()
              .setInitialView(latitude, longitude, 10)
              .setMapStyle("mapbox://styles/mapbox/streets-v12")
              .addMarkers(
                placeList.map((place) => ({
                  latitude: place.latitude,
                  longitude: place.longitude,
                  title: place.name,
                  description: `Explore ${place.name}`,
                  text: place.name,
                }))
              )
              .build()
          )
          .content(`Discover exciting activities in ${locationName} today!`)
          .build(),
      };
    } catch (error) {
      console.error("Error fetching places:", error);
      return {
        text: `Sorry, we couldn't fetch activities for ${locationName}. Please try again later.`,
        data: {},
        ui: new CardUIBuilder()
          .setRenderMode("page")
          .title("Error")
          .content(`There was an issue fetching the activities. Please try again later.`)
          .build(),
      };
    }
  },
};

const getFunRecWidget: ServicePinnable = {
  id: "funRec",
  name: "Recreation Activities",
  description: "Shows available recreational activities",
  type: "widget",
  label: "Recreation",
  icon: "map",

  getWidget: async () => {
    try {
      // Fetch recreation data
      const recResults = await fetchRecreationData();

      // Recreation Table UI
      const recTableUI = new TableUIBuilder()
        .addColumns([
          {
            key: "name", header: "Activity",
            type: ""
          },
          {
            key: "location", header: "Location",
            type: ""
          },
          {
            key: "cost", header: "Cost ($)",
            type: ""
          }
        ])
        .rows(recResults);

      // Compose UI Layout
      const cardUI = new CardUIBuilder()
        .title("Recreation Activities")
        .addChild(new AlertUIBuilder().variant("info").message("Explore fun activities near you!").build())
        .addChild(recTableUI.build());

      return new DainResponse({
        text: "Recreation data loaded",
        data: recResults,
        ui: cardUI.build()
      });

    } catch (error) {
      return new DainResponse({
        text: "Failed to load recreation data",
        data: null,
        ui: new AlertUIBuilder()
          .variant("error")
          .message("Unable to load activities. Please try again later.")
          .build()
        });
      }
    }
  };


const dainService = defineDAINService({
  metadata: {
    title: "FunRec DAIN Service",
    description: "A DAIN service for recommending Activities API",
    version: "1.0.0",
    author: "Mark and Renzo",
    tags: ["Activities", "fun", "dain"],
    logo: "https://img.icons8.com/?size=100&id=2qSx1JG5SSGn&format=png&color=000000",
  },
  exampleQueries: [
    {
      category: "Activities",
      queries: [
        "What fun activities around Carson?",
        "What fun activities around Cerritos?",
        "What fun activities around LongBeach?",
      ],
    },
  ],
  identity: {
    apiKey: process.env.DAIN_API_KEY,
  },
  tools: [getFunRec],
});

dainService.startNode({ port: port }).then(({ address }) => {
  console.log("FunRec DAIN Service is running at :" + address().port);
});



// Purpose ng hook, is to hold states, and manipulate. BASICALLY ANYTHING THAT REQUIRES REACT. 
//
// REACT == useState, useEffect, useContext, useReducer, useMemo, useCallback, etc.
//
// No react == simple js, .math .splice .reduce


const [username, setUsername] = useState("");
// hooks will hold all the states, that we will consume on components 


// useEffect that will trigger services (supabase) to fetch data.you will call the services here, and then set the states 



return { name: { userName, setUsername } }; // return the states and setters as an object, so that we can consume it on components


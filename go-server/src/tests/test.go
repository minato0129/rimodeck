package tests

import (
	"log"
	"rimodeck/services"
)

func Test() {
	err := services.CreateUser("testuser", "testpassword")
	if err != nil {
		log.Print(err)
		return
	}

	log.Print("User1 created successfully")

	err = services.CreateUser("testuser", "testpassword")
	if err != nil {
		log.Print(err)
		return
	}
		
	log.Print("User2 created successfully")


	err = services.LoginUser("testuser", "testpassword")
	if err != nil {
		log.Print(err)
		return
	}
	log.Print("User logged in successfully")


}

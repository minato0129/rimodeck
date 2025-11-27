package tests

import (
	"log"
	"rimodeck/services"
)

func Test() {
	err := services.CreateUser("testuser", "testpassword")
	if err != nil {
		log.Print(err)
	}

	log.Print("User1 created successfully")

	err = services.CreateUser("testuser", "testpassword")
	if err != nil {
		log.Print(err)
	}
		
	log.Print("User2 created successfully")

	result := services.LoginUser("testuser", "testpassword")
	if result.Error != nil {
		log.Print(err)
	}
	log.Print("User logged in successfully")
	log.Print(result)

}

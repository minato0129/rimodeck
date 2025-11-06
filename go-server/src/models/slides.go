package models

import "time"

type Slides struct {
	SlideID   string `gorm:"primaryKey"` 
	UserID    string 
	CreatedAt time.Time
	UpdatedAt time.Time
	Peages []Peages `gorm:"foreignKey:SlideID"`
}
